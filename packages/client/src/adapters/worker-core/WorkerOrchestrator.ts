/**
 * Worker orchestrator — creates and owns all CQRS components inside the worker.
 *
 * Receives resolved config at construction time (the consumer's worker entry
 * point imports config and passes it to startDedicatedWorker/startSharedWorker).
 *
 * Lifecycle methods (`initialize`, `close`) are registered externally by the
 * startup functions (`startDedicatedWorker`, `startSharedWorker`) since each
 * mode has a different initialization flow:
 * - Mode B: orchestrator probes OPFS and creates a local database
 * - Mode C: startSharedWorker manages RemoteSqliteDb and passes it in
 */

import type { Link } from '@meticoeus/ddd-es'
import type { Subscription } from 'rxjs'
import { CacheManager } from '../../core/cache-manager/CacheManager.js'
import { CommandIdMappingStore } from '../../core/command-id-mapping-store/CommandIdMappingStore.js'
import { AnticipatedEventHandler } from '../../core/command-lifecycle/AnticipatedEventHandler.js'
import type { IAnticipatedEvent } from '../../core/command-lifecycle/AnticipatedEventShape.js'
import { createCommandResponseHandler } from '../../core/command-lifecycle/createCommandResponseHandler.js'
import { CommandQueue } from '../../core/command-queue/CommandQueue.js'
import type { ICommandFileStore } from '../../core/command-queue/file-store/ICommandFileStore.js'
import { CommandStore } from '../../core/command-store/CommandStore.js'
import { EventCache } from '../../core/event-cache/EventCache.js'
import { EventProcessorRegistry } from '../../core/event-processor/EventProcessorRegistry.js'
import { EventProcessorRunner } from '../../core/event-processor/EventProcessorRunner.js'
import { EventBus } from '../../core/events/EventBus.js'
import { QueryManager } from '../../core/query-manager/QueryManager.js'
import { ReadModelStore } from '../../core/read-model-store/ReadModelStore.js'
import { SessionManager } from '../../core/session/SessionManager.js'
import { ConnectivityManager } from '../../core/sync-manager/ConnectivityManager.js'
import { SyncManager } from '../../core/sync-manager/SyncManager.js'
import { WriteQueue } from '../../core/write-queue/WriteQueue.js'
import type { WorkerMessageHandler } from '../../protocol/MessageChannel.js'
import type { ISqliteDb } from '../../storage/ISqliteDb.js'
import type { IStorage } from '../../storage/IStorage.js'
import { loadAndOpenDb } from '../../storage/LocalSqliteDb.js'
import { SQLiteStorage } from '../../storage/SQLiteStorage.js'
import { DEFAULT_CONFIG } from '../../types/config.js'
import { createDomainExecutor } from '../../types/domain.js'
import { EnqueueCommand, ResolvedConfig } from '../../types/index.js'
import { probeOpfs } from './probeOpfs.js'
import { registerCacheManagerMethods } from './registerCacheManagerMethods.js'
import { registerCommandQueueMethods } from './registerCommandQueueMethods.js'
import { registerDebugMethods } from './registerDebugMethods.js'
import { registerQueryManagerMethods } from './registerQueryManagerMethods.js'
import { registerSyncManagerMethods } from './registerSyncManagerMethods.js'

/**
 * Options for {@link WorkerOrchestrator.initialize}.
 */
export interface WorkerOrchestratorInitOptions {
  /** Pre-configured ISqliteDb (e.g., RemoteSqliteDb for Mode C, BetterSqliteDb for Electron). */
  externalDb?: ISqliteDb
  /** File store for command file uploads. */
  fileStore: ICommandFileStore
}

/**
 * Worker orchestrator manages the full lifecycle of CQRS components inside a worker.
 *
 * Config is provided at construction time (from the consumer's worker entry point).
 * Lifecycle methods are registered externally by the startup functions.
 */
export class WorkerOrchestrator<
  TLink extends Link,
  TCommand extends EnqueueCommand,
  TSchema,
  TEvent extends IAnticipatedEvent,
> {
  private readonly messageHandler: WorkerMessageHandler
  private readonly config: ResolvedConfig<TLink, TCommand, TSchema, TEvent>

  private storage: IStorage<TLink, TCommand> | undefined
  private sessionManager: SessionManager<TLink, TCommand> | undefined
  private cacheManager: CacheManager<TLink, TCommand> | undefined
  private eventCache: EventCache<TLink, TCommand> | undefined
  private readModelStore: ReadModelStore<TLink, TCommand> | undefined
  private commandStore: CommandStore<TLink, TCommand> | undefined
  private mappingStore: CommandIdMappingStore<TLink, TCommand> | undefined
  private commandQueue: CommandQueue<TLink, TCommand, TSchema, TEvent> | undefined
  private queryManager: QueryManager<TLink, TCommand> | undefined
  private syncManager: SyncManager<TLink, TCommand, TSchema, TEvent> | undefined
  private writeQueue: WriteQueue<TLink, TCommand> | undefined
  private eventBroadcastSub: Subscription | undefined

  constructor(
    private readonly eventBus: EventBus<TLink>,
    messageHandler: WorkerMessageHandler,
    config: ResolvedConfig<TLink, TCommand, TSchema, TEvent>,
  ) {
    this.messageHandler = messageHandler
    this.config = config
  }

  /**
   * Initialize all CQRS components.
   *
   * @param options - Initialization options including the file store and optional external DB.
   *   When `externalDb` is omitted, probes OPFS and creates a local db (Mode B).
   */
  async initialize(options: WorkerOrchestratorInitOptions): Promise<void> {
    const config = this.config

    // 1. Run worker setup scripts
    if (config.workerSetup) {
      for (const url of config.workerSetup) {
        await import(/* @vite-ignore */ url)
      }
    }

    // 2. Create database handle and initialize storage
    const dbName = config.storage.dbName ?? DEFAULT_CONFIG.storage.dbName
    const vfs = config.storage.vfs ?? 'opfs'
    let db: ISqliteDb

    if (options.externalDb) {
      db = options.externalDb
    } else {
      // Mode B (DedicatedWorker): probe OPFS, create local db
      const probeResult = await probeOpfs()
      if (!probeResult.ok) {
        throw probeResult.error
      }
      db = await loadAndOpenDb({ dbName, vfs })
    }

    const storage = new SQLiteStorage<TLink, TCommand>({
      db,
      migrations: config.storage.migrations,
    })
    await storage.initialize()
    this.storage = storage

    // 3. use EventBus and bridge to broadcast
    const eventBus = this.eventBus
    this.eventBroadcastSub = eventBus.events$.subscribe((event) => {
      this.messageHandler.broadcastEvent(event.type, event.data, event.debug)
    })

    // 4. Create SessionManager
    const sessionManager = new SessionManager(storage, eventBus)
    await sessionManager.initialize()
    this.sessionManager = sessionManager

    // 5. Register event processors
    const registry = new EventProcessorRegistry()
    for (const registration of config.processors) {
      registry.register(registration)
    }

    // 6. Create CacheManager
    const cacheManager = new CacheManager<TLink, TCommand>(eventBus, storage, {
      cacheConfig: config.cache,
    })
    await cacheManager.initialize()
    this.cacheManager = cacheManager

    // 7. Create EventCache
    const eventCache = new EventCache(storage)
    this.eventCache = eventCache

    // 8. Create ReadModelStore
    const mappingStore = new CommandIdMappingStore<TLink, TCommand>(storage)
    await mappingStore.initialize()
    this.mappingStore = mappingStore

    const readModelStore = new ReadModelStore(eventBus, storage, mappingStore)
    this.readModelStore = readModelStore

    // 8.5. Create and initialize CommandStore
    const commandStore = new CommandStore(storage, {
      retainTerminal: config.retainTerminal,
    })
    await commandStore.initialize()
    this.commandStore = commandStore

    // 9. Create EventProcessorRunner
    const eventProcessorRunner = new EventProcessorRunner(eventBus, registry, readModelStore)

    // 10. Create WriteQueue — subsystems register their own handlers in their constructors.
    const writeQueue = new WriteQueue<TLink, TCommand>(eventBus)
    this.writeQueue = writeQueue

    // 11. Create CommandQueue with anticipated event handler and response handler
    let syncManagerRef: SyncManager<TLink, TCommand, TSchema, TEvent>

    const anticipatedEventHandler = new AnticipatedEventHandler(
      eventBus,
      eventCache,
      registry,
      readModelStore,
      config.collections,
      writeQueue,
    )

    const queryManager = new QueryManager<TLink, TCommand>(eventBus, cacheManager, readModelStore)
    this.queryManager = queryManager

    const domainExecutor =
      config.commandHandlers.length === 0
        ? undefined
        : createDomainExecutor<TLink, TCommand, TSchema, TEvent>(config.commandHandlers, {
            schemaValidator: config.schemaValidator,
            queryManager,
          })
    const commandQueue = new CommandQueue<TLink, TCommand, TSchema, TEvent>(
      eventBus,
      storage,
      options.fileStore,
      anticipatedEventHandler,
      config.aggregates,
      readModelStore,
      commandStore,
      mappingStore,
      {
        domainExecutor,
        commandSender: config.commandSender,
        retryConfig: config.retry,
        retainTerminal: config.retainTerminal,
        onCommandResponse: createCommandResponseHandler<TLink, TCommand, TSchema, TEvent>(
          () => syncManagerRef,
          config.collections,
        ),
      },
    )
    this.commandQueue = commandQueue

    // 13. Create SyncManager — sets the queue's session reset handler internally.
    const connectivity = new ConnectivityManager<TLink>(eventBus, {
      healthCheckUrl: `${config.network.baseUrl}/health`,
    })

    const syncManager = new SyncManager<TLink, TCommand, TSchema, TEvent>(
      eventBus,
      storage,
      sessionManager,
      anticipatedEventHandler,
      commandQueue,
      eventCache,
      cacheManager,
      registry,
      eventProcessorRunner,
      readModelStore,
      queryManager,
      writeQueue,
      connectivity,
      config.network,
      config.auth,
      config.collections,
      config.aggregates,
      domainExecutor,
      commandStore,
      mappingStore,
    )
    syncManagerRef = syncManager
    this.syncManager = syncManager

    // Wire cross-dependencies (property-set to break circular refs)
    cacheManager.setWriteQueue(writeQueue)
    cacheManager.setCommandQueue(commandQueue)
    commandQueue.setCacheManager(cacheManager)

    await commandQueue.initialize()

    // 14. Register RPC methods for all components
    registerCommandQueueMethods(this.messageHandler, commandQueue, eventBus)
    registerQueryManagerMethods(this.messageHandler, queryManager)
    registerCacheManagerMethods(this.messageHandler, cacheManager)
    registerSyncManagerMethods(this.messageHandler, syncManager, sessionManager)

    // 14. Wire stale window cleanup (§10.5) — when heartbeat detects a dead window,
    // release all its cache key holds so ephemeral keys can be evicted.
    // TODO: also wire cacheManager.registerWindow(windowId) on window connect
    // for capacity tracking (currently only tracked in online-only mode)
    this.messageHandler.onWindowRemoved(async (windowId: string) => {
      await cacheManager.unregisterWindow(windowId)
    })

    // 15. Register hold restoration handler (§10.6.4) — windows restore their
    // held cache keys after detecting a worker restart.
    this.messageHandler.setRestoreHoldsHandler(async (data) => {
      const restoredKeys: string[] = []
      const failedKeys: string[] = []

      for (const key of data.cacheKeys) {
        const exists = await cacheManager.exists(key)
        if (exists) {
          cacheManager.holdForWindow(key, data.windowId)
          restoredKeys.push(key)
        } else {
          failedKeys.push(key)
        }
      }

      return { restoredKeys, failedKeys }
    })

    // 16. Register debug.enable RPC — enables debug events and lazily registers
    // debug snapshot methods on first call.
    let debugRegistered = false
    this.messageHandler.registerMethod('debug.enable', async () => {
      eventBus.debug = true
      if (!debugRegistered) {
        debugRegistered = true
        registerDebugMethods(this.messageHandler, {
          commandQueue,
          cacheManager,
          syncManager,
          storage,
          db,
        })
      }
    })

    // 15. Start sync
    await syncManager.start()
  }

  /**
   * Close all CQRS components and release resources.
   */
  async close(): Promise<void> {
    this.writeQueue?.destroy()
    this.eventCache?.destroy()
    await this.syncManager?.destroy()
    await this.queryManager?.destroy()
    await this.commandQueue?.destroy()
    await this.commandStore?.destroy()
    await this.mappingStore?.destroy()
    this.eventBroadcastSub?.unsubscribe()
    this.eventBus?.complete()
    await this.storage?.close()
  }
}
