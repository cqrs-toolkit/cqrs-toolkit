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

import { logProvider } from '@meticoeus/ddd-es'
import type { Subscription } from 'rxjs'
import { CacheManager } from '../../core/cache-manager/CacheManager.js'
import type { IAnticipatedEventHandler } from '../../core/command-queue/CommandQueue.js'
import { CommandQueue } from '../../core/command-queue/CommandQueue.js'
import { EventCache } from '../../core/event-cache/EventCache.js'
import { EventProcessorRegistry } from '../../core/event-processor/EventProcessorRegistry.js'
import type { ParsedEvent } from '../../core/event-processor/EventProcessorRunner.js'
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
import type { TerminalCommandStatus } from '../../types/commands.js'
import type {
  Collection,
  CommandRecord,
  EventPersistence,
  ResolvedConfig,
} from '../../types/index.js'
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
export class WorkerOrchestrator {
  private readonly messageHandler: WorkerMessageHandler
  private readonly config: ResolvedConfig

  private storage: IStorage | undefined
  private eventBus: EventBus | undefined
  private sessionManager: SessionManager | undefined
  private cacheManager: CacheManager | undefined
  private eventCache: EventCache | undefined
  private readModelStore: ReadModelStore | undefined
  private commandQueue: CommandQueue | undefined
  private queryManager: QueryManager | undefined
  private syncManager: SyncManager | undefined
  private eventBroadcastSub: Subscription | undefined
  private evictionSub: Subscription | undefined

  constructor(messageHandler: WorkerMessageHandler, config: ResolvedConfig) {
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

    const storage = new SQLiteStorage({ db })
    await storage.initialize()
    this.storage = storage

    // 3. Create EventBus and bridge to broadcast
    const eventBus = new EventBus()
    this.eventBus = eventBus
    this.eventBroadcastSub = eventBus.events$.subscribe((event) => {
      this.messageHandler.broadcastEvent(event.type, event.payload, event.debug)
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
    const cacheManager = new CacheManager({
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
    let syncManagerRef: SyncManager
    const commandQueue = new CommandQueue({
      storage,
      eventBus,
      anticipatedEventHandler: createAnticipatedEventHandler(
        eventCache,
        cacheManager,
        eventProcessorRunner,
        readModelStore,
        config.collections,
      ),
      domainExecutor: config.domainExecutor,
      commandSender: config.commandSender,
      retryConfig: config.retry,
      retainTerminal: config.retainTerminal,
      onCommandResponse: createCommandResponseHandler(
        () => syncManagerRef,
        cacheManager,
        config.collections,
      ),
    })
    this.commandQueue = commandQueue

    // 11. Create QueryManager
    const queryManager = new QueryManager({
      eventBus,
      cacheManager,
      readModelStore,
    })
    this.queryManager = queryManager

    // 12. Create SyncManager
    const syncManager = new SyncManager({
      eventBus,
      sessionManager,
      commandQueue,
      eventCache,
      cacheManager,
      eventProcessor: eventProcessorRunner,
      readModelStore,
      queryManager,
      networkConfig: config.network,
      collections: config.collections,
    })
    syncManagerRef = syncManager
    this.syncManager = syncManager

    // 13. Subscribe to cache:evicted for cross-component cleanup
    this.evictionSub = eventBus.on('cache:evicted').subscribe((event) => {
      const streamIds = eventCache.clearByCacheKey(event.payload.cacheKey)
      syncManager.clearKnownRevisions(streamIds)
      queryManager.releaseForCacheKey(event.payload.cacheKey)
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

// ---------------------------------------------------------------------------
// Anticipated event handling (same logic as createCqrsClient.ts)
// ---------------------------------------------------------------------------

interface AnticipatedEventShape {
  type: string
  data: unknown
  streamId: string
}

function isAnticipatedEventShape(value: unknown): value is AnticipatedEventShape {
  if (typeof value !== 'object' || value === null) return false
  return (
    'type' in value &&
    typeof value.type === 'string' &&
    'data' in value &&
    'streamId' in value &&
    typeof value.streamId === 'string'
  )
}

function createAnticipatedEventHandler(
  eventCache: EventCache,
  cacheManager: CacheManager,
  eventProcessorRunner: EventProcessorRunner,
  readModelStore: ReadModelStore,
  collections: Collection[],
): IAnticipatedEventHandler {
  const anticipatedUpdates = new Map<string, string[]>()

  return {
    async cache(commandId: string, events: unknown[]): Promise<void> {
      const updatedIds: string[] = []

      for (const raw of events) {
        if (!isAnticipatedEventShape(raw)) continue

        const collection = collections.find((c) => c.matchesStream(raw.streamId))
        if (!collection) {
          logProvider.log.warn(
            { streamId: raw.streamId, commandId },
            'Could not derive collection from streamId in anticipated event',
          )
          continue
        }

        const cacheKey = await cacheManager.acquire(collection.name)

        const eventId = await eventCache.cacheAnticipatedEvent(
          { type: raw.type, data: raw.data, streamId: raw.streamId, commandId },
          { cacheKey, commandId },
        )

        const parsed: ParsedEvent = {
          id: eventId,
          type: raw.type,
          streamId: raw.streamId,
          persistence: 'Anticipated',
          data: raw.data,
          commandId,
          cacheKey,
        }

        const result = await eventProcessorRunner.processEvent(parsed)
        updatedIds.push(...result.updatedIds)
      }

      if (updatedIds.length > 0) {
        anticipatedUpdates.set(commandId, updatedIds)
      }
    },

    async cleanup(commandId: string, terminalStatus: TerminalCommandStatus): Promise<void> {
      await eventCache.deleteAnticipatedEvents(commandId)

      const tracked = anticipatedUpdates.get(commandId)
      anticipatedUpdates.delete(commandId)

      if ((terminalStatus === 'failed' || terminalStatus === 'cancelled') && tracked) {
        for (const key of tracked) {
          const separatorIndex = key.indexOf(':')
          if (separatorIndex === -1) continue
          const collection = key.substring(0, separatorIndex)
          const id = key.substring(separatorIndex + 1)
          await readModelStore.clearLocalChanges(collection, id)
        }
      }
    },

    async clearAll(): Promise<void> {
      anticipatedUpdates.clear()
    },
  }
}

// ---------------------------------------------------------------------------
// Command response event processing (same logic as createCqrsClient.ts)
// ---------------------------------------------------------------------------

interface ResponseEvent {
  id: string
  type: string
  streamId: string
  data: unknown
  persistence?: EventPersistence
  revision: string
  position: string
}

function hasResponseEvents(response: unknown): response is { events: ResponseEvent[] } {
  if (typeof response !== 'object' || response === null) return false
  if (!('events' in response)) return false
  return Array.isArray(response.events)
}

function isResponseEvent(value: unknown): value is ResponseEvent {
  if (typeof value !== 'object' || value === null) return false
  return (
    'id' in value &&
    typeof value.id === 'string' &&
    'type' in value &&
    typeof value.type === 'string' &&
    'streamId' in value &&
    typeof value.streamId === 'string' &&
    'data' in value &&
    'revision' in value &&
    typeof value.revision === 'string' &&
    'position' in value &&
    typeof value.position === 'string'
  )
}

function createCommandResponseHandler(
  getSyncManager: () => SyncManager,
  cacheManager: CacheManager,
  collections: Collection[],
): (command: CommandRecord, response: unknown) => Promise<void> {
  return async (command: CommandRecord, response: unknown) => {
    if (!hasResponseEvents(response)) return

    const events = response.events
    if (events.length === 0) return

    const parsedEvents: ParsedEvent[] = []

    for (const raw of events) {
      if (!isResponseEvent(raw)) continue

      const collection = collections.find((c) => c.matchesStream(raw.streamId))
      if (!collection) {
        logProvider.log.warn(
          { streamId: raw.streamId, commandId: command.commandId },
          'Could not derive collection from streamId in command response',
        )
        continue
      }

      const cacheKey = await cacheManager.acquire(collection.name)

      parsedEvents.push({
        id: raw.id,
        type: raw.type,
        streamId: raw.streamId,
        persistence: raw.persistence ?? 'Permanent',
        data: raw.data,
        commandId: command.commandId,
        revision: BigInt(raw.revision),
        position: BigInt(raw.position),
        cacheKey,
      })
    }

    if (parsedEvents.length > 0) {
      await getSyncManager().processResponseEvents(parsedEvents)
    }
  }
}
