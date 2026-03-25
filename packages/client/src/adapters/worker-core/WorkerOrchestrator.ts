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
import type { IAnticipatedEvent } from '../../core/command-lifecycle/AnticipatedEventShape.js'
import { createAnticipatedEventHandler } from '../../core/command-lifecycle/createAnticipatedEventHandler.js'
import { createCommandResponseHandler } from '../../core/command-lifecycle/createCommandResponseHandler.js'
import { CommandQueue } from '../../core/command-queue/CommandQueue.js'
import { EventCache } from '../../core/event-cache/EventCache.js'
import { EventProcessorRegistry } from '../../core/event-processor/EventProcessorRegistry.js'
import { EventProcessorRunner } from '../../core/event-processor/EventProcessorRunner.js'
import { EventBus } from '../../core/events/EventBus.js'
import { QueryManager } from '../../core/query-manager/QueryManager.js'
import { ReadModelStore } from '../../core/read-model-store/ReadModelStore.js'
import { SessionManager } from '../../core/session/SessionManager.js'
import { SyncManager } from '../../core/sync-manager/SyncManager.js'
import type { WorkerMessageHandler } from '../../protocol/MessageChannel.js'
import type { ISqliteDb } from '../../storage/ISqliteDb.js'
import type { IStorage } from '../../storage/IStorage.js'
import { loadAndOpenDb } from '../../storage/LocalSqliteDb.js'
import { SQLiteStorage } from '../../storage/SQLiteStorage.js'
import { createDomainExecutor } from '../../types/domain.js'
import type { ResolvedConfig } from '../../types/index.js'
import { probeOpfs } from './probeOpfs.js'
import { registerCacheManagerMethods } from './registerCacheManagerMethods.js'
import { registerCommandQueueMethods } from './registerCommandQueueMethods.js'
import { registerDebugMethods } from './registerDebugMethods.js'
import { registerQueryManagerMethods } from './registerQueryManagerMethods.js'
import { registerSyncManagerMethods } from './registerSyncManagerMethods.js'

/**
 * Worker orchestrator manages the full lifecycle of CQRS components inside a worker.
 *
 * Config is provided at construction time (from the consumer's worker entry point).
 * Lifecycle methods are registered externally by the startup functions.
 */
export class WorkerOrchestrator<TLink extends Link, TSchema, TEvent extends IAnticipatedEvent> {
  private readonly messageHandler: WorkerMessageHandler
  private readonly config: ResolvedConfig<TLink, TSchema, TEvent>

  private storage: IStorage | undefined
  private eventBus: EventBus | undefined
  private sessionManager: SessionManager | undefined
  private cacheManager: CacheManager<TLink> | undefined
  private eventCache: EventCache | undefined
  private readModelStore: ReadModelStore | undefined
  private commandQueue: CommandQueue<TLink, TSchema, TEvent> | undefined
  private queryManager: QueryManager<TLink> | undefined
  private syncManager: SyncManager<TLink, TSchema, TEvent> | undefined
  private eventBroadcastSub: Subscription | undefined
  private evictionSub: Subscription | undefined

  constructor(
    messageHandler: WorkerMessageHandler,
    config: ResolvedConfig<TLink, TSchema, TEvent>,
  ) {
    this.messageHandler = messageHandler
    this.config = config
  }

  /**
   * Initialize all CQRS components.
   *
   * @param externalDb - Pre-configured ISqliteDb (Mode C: RemoteSqliteDb managed
   *   by startSharedWorker). When omitted, probes OPFS and creates a local db (Mode B).
   */
  async initialize(externalDb?: ISqliteDb): Promise<void> {
    const config = this.config

    // 1. Run worker setup scripts
    if (config.workerSetup) {
      for (const url of config.workerSetup) {
        await import(/* @vite-ignore */ url)
      }
    }

    // 2. Create database handle and initialize storage
    const dbName = config.storage.dbName ?? 'cqrs-client'
    const vfs = config.storage.vfs ?? 'opfs'
    let db: ISqliteDb

    if (externalDb) {
      // Mode C (SharedWorker): RemoteSqliteDb managed by startSharedWorker
      db = externalDb
    } else {
      // Mode B (DedicatedWorker): probe OPFS, create local db
      const probeResult = await probeOpfs()
      if (!probeResult.ok) {
        throw probeResult.error
      }
      db = await loadAndOpenDb({ dbName, vfs })
    }

    const storage = new SQLiteStorage({ db, migrations: config.storage.migrations })
    await storage.initialize()
    this.storage = storage

    // 3. Create EventBus and bridge to broadcast
    const eventBus = new EventBus()
    this.eventBus = eventBus
    this.eventBroadcastSub = eventBus.events$.subscribe((event) => {
      this.messageHandler.broadcastEvent(event.type, event.data, event.debug)
    })

    // 4. Create SessionManager
    const sessionManager = new SessionManager({ storage, eventBus })
    await sessionManager.initialize()
    this.sessionManager = sessionManager

    // 5. Register event processors
    const registry = new EventProcessorRegistry()
    for (const registration of config.processors) {
      registry.register(registration)
    }

    // 6. Create CacheManager
    const windowId = crypto.randomUUID()
    const cacheManager = new CacheManager<TLink>({
      storage,
      eventBus,
      cacheConfig: config.cache,
      windowId,
    })
    await cacheManager.initialize()
    this.cacheManager = cacheManager

    // 7. Create EventCache
    const eventCache = new EventCache({ storage, eventBus })
    this.eventCache = eventCache

    // 8. Create ReadModelStore
    const readModelStore = new ReadModelStore({ storage })
    this.readModelStore = readModelStore

    // 9. Create EventProcessorRunner
    const eventProcessorRunner = new EventProcessorRunner({
      readModelStore,
      eventBus,
      registry,
    })

    // 10. Create CommandQueue with anticipated event handler and response handler
    let syncManagerRef: SyncManager<TLink, TSchema, TEvent>

    const anticipatedEventHandler = createAnticipatedEventHandler(
      eventCache,
      cacheManager,
      eventProcessorRunner,
      readModelStore,
      config.collections,
    )
    eventProcessorRunner.setAnticipatedEventHandler(anticipatedEventHandler)

    const queryManager = new QueryManager<TLink>({
      eventBus,
      cacheManager,
      readModelStore,
    })
    this.queryManager = queryManager

    const commandQueue = new CommandQueue<TLink, TSchema, TEvent>({
      storage,
      eventBus,
      anticipatedEventHandler,
      ...(() => {
        if (config.commandHandlers.length === 0) return {}
        const executor = createDomainExecutor<TLink, TSchema, TEvent>(config.commandHandlers, {
          schemaValidator: config.schemaValidator,
          queryManager,
        })
        return { domainExecutor: executor, handlerMetadata: executor }
      })(),
      commandSender: config.commandSender,
      retryConfig: config.retry,
      retainTerminal: config.retainTerminal,
      onCommandResponse: createCommandResponseHandler<TLink, TSchema, TEvent>(
        () => syncManagerRef,
        cacheManager,
        config.collections,
      ),
    })
    this.commandQueue = commandQueue

    // 12. Create SyncManager
    const syncManager = new SyncManager<TLink, TSchema, TEvent>({
      eventBus,
      sessionManager,
      commandQueue,
      eventCache,
      cacheManager,
      eventProcessor: eventProcessorRunner,
      readModelStore,
      queryManager,
      networkConfig: config.network,
      auth: config.auth,
      collections: config.collections,
    })
    syncManagerRef = syncManager
    this.syncManager = syncManager

    // 13. Subscribe to cache:evicted for cross-component cleanup
    this.evictionSub = eventBus.on('cache:evicted').subscribe((event) => {
      const streamIds = eventCache.clearByCacheKey(event.data.cacheKey)
      syncManager.clearKnownRevisions(streamIds)
      queryManager.releaseForCacheKey(event.data.cacheKey)
    })

    // 14. Register RPC methods for all components
    registerCommandQueueMethods(this.messageHandler, commandQueue)
    registerQueryManagerMethods(this.messageHandler, queryManager)
    registerCacheManagerMethods(this.messageHandler, cacheManager)
    registerSyncManagerMethods(this.messageHandler, syncManager, sessionManager)

    // 15b. Register debug.enable RPC — enables debug events and lazily registers
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
    this.evictionSub?.unsubscribe()
    this.eventCache?.destroy()
    await this.syncManager?.destroy()
    await this.queryManager?.destroy()
    await this.commandQueue?.destroy()
    this.eventBroadcastSub?.unsubscribe()
    this.eventBus?.complete()
    await this.storage?.close()
  }
}
