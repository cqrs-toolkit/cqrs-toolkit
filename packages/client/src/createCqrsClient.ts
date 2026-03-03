/**
 * Public entry point for the CQRS Client library.
 *
 * Provides an async factory function that wires all internal components together
 * and returns an initialized {@link CqrsClient} instance.
 *
 * @packageDocumentation
 */

import { logProvider } from '@meticoeus/ddd-es'
import assert from 'node:assert'
import type { Observable } from 'rxjs'
import type { AdapterStatus, IAdapter } from './adapters/base/BaseAdapter.js'
import { DedicatedWorkerAdapter } from './adapters/dedicated-worker/DedicatedWorkerAdapter.js'
import { MainThreadAdapter } from './adapters/main-thread/MainThreadAdapter.js'
import { OnlineOnlyAdapter } from './adapters/online-only/OnlineOnlyAdapter.js'
import { SharedWorkerAdapter } from './adapters/shared-worker/SharedWorkerAdapter.js'
import { CacheManager } from './core/cache-manager/CacheManager.js'
import { CommandQueue } from './core/command-queue/CommandQueue.js'
import type { ICommandQueue } from './core/command-queue/types.js'
import { detectMode } from './core/detectMode.js'
import { EventCache } from './core/event-cache/EventCache.js'
import { EventProcessorRegistry } from './core/event-processor/EventProcessorRegistry.js'
import type { ParsedEvent } from './core/event-processor/EventProcessorRunner.js'
import { EventProcessorRunner } from './core/event-processor/EventProcessorRunner.js'
import { QueryManager } from './core/query-manager/QueryManager.js'
import { ReadModelStore } from './core/read-model-store/ReadModelStore.js'
import type { SessionManager } from './core/session/SessionManager.js'
import { ConnectivityManager } from './core/sync-manager/ConnectivityManager.js'
import type { CollectionSyncStatus } from './core/sync-manager/SyncManager.js'
import { SyncManager } from './core/sync-manager/SyncManager.js'
import type { CommandRecord } from './types/commands.js'
import type {
  CqrsClientConfig,
  ExecutionMode,
  ExecutionModeConfig,
  ResolvedConfig,
} from './types/config.js'
import { resolveConfig } from './types/config.js'
import type { LibraryEvent } from './types/events.js'

/**
 * Restricted view of SyncManager exposed to consumers.
 * Start/stop are managed internally by the client lifecycle.
 */
export interface CqrsClientSyncManager {
  /** Get sync status for a specific collection. */
  getCollectionStatus(collection: string): CollectionSyncStatus | null
  /** Get sync status for all collections. */
  getAllStatus(): CollectionSyncStatus[]
  /** Force-sync a specific collection from the server. */
  syncCollection(collection: string): Promise<void>
  /** Connectivity manager for network status observation. */
  readonly connectivity: ConnectivityManager
}

/**
 * CQRS Client instance returned by {@link createCqrsClient}.
 *
 * All fields are available immediately — the client is fully initialized at construction time.
 */
export class CqrsClient {
  /** Cache manager for cache key lifecycle and eviction. */
  readonly cacheManager: CacheManager
  /** Command queue for enqueuing and tracking commands. */
  readonly commandQueue: ICommandQueue
  /** Query manager for reading cached data. */
  readonly queryManager: QueryManager
  /** Resolved execution mode. */
  readonly mode: ExecutionMode

  private readonly adapter: IAdapter
  private readonly internalCommandQueue: CommandQueue
  private readonly internalSyncManager: SyncManager
  private readonly eventCache: EventCache
  private readonly readModelStore: ReadModelStore
  private readonly eventProcessorRunner: EventProcessorRunner

  constructor(
    adapter: IAdapter,
    cacheManager: CacheManager,
    commandQueue: CommandQueue,
    syncManager: SyncManager,
    queryManager: QueryManager,
    eventCache: EventCache,
    readModelStore: ReadModelStore,
    eventProcessorRunner: EventProcessorRunner,
    mode: ExecutionMode,
  ) {
    this.adapter = adapter
    this.cacheManager = cacheManager
    this.commandQueue = commandQueue
    this.internalCommandQueue = commandQueue
    this.internalSyncManager = syncManager
    this.queryManager = queryManager
    this.eventCache = eventCache
    this.readModelStore = readModelStore
    this.eventProcessorRunner = eventProcessorRunner
    this.mode = mode
  }

  /** Sync manager for collection sync status and manual triggers. */
  get syncManager(): CqrsClientSyncManager {
    const sm = this.internalSyncManager
    return {
      getCollectionStatus: (collection) => sm.getCollectionStatus(collection),
      getAllStatus: () => sm.getAllStatus(),
      syncCollection: (collection) => sm.syncCollection(collection),
      get connectivity() {
        return sm.getConnectivity()
      },
    }
  }

  /** Session manager for user identity and session lifecycle. */
  get sessionManager(): SessionManager {
    return this.adapter.sessionManager
  }

  /** Observable of all library events. */
  get events$(): Observable<LibraryEvent> {
    return this.adapter.events$
  }

  /** Current adapter status. */
  get status(): AdapterStatus {
    return this.adapter.status
  }

  /**
   * Close the client and release all resources.
   * Stops sync, destroys components, and closes the adapter.
   */
  async close(): Promise<void> {
    this.internalSyncManager.stop()
    this.queryManager.destroy()
    this.internalCommandQueue.destroy()
    await this.adapter.close()
  }
}

/**
 * Create a new CQRS Client instance.
 *
 * Resolves configuration, initializes the adapter, registers event processors,
 * wires all components, starts sync, and returns a fully initialized client.
 *
 * @example
 * ```typescript
 * import { createCqrsClient } from '@cqrs-toolkit/client'
 *
 * const client = await createCqrsClient({
 *   network: { baseUrl: '/api', wsUrl: 'ws://localhost:3000/events' },
 *   collections: [{ name: 'todos', seedOnInit: true }],
 *   processors: [
 *     {
 *       eventTypes: 'TodoCreated',
 *       processor: (data, ctx) => ({
 *         collection: 'todos',
 *         id: data.id,
 *         update: { type: 'set', data },
 *         isServerUpdate: ctx.persistence !== 'Anticipated',
 *       }),
 *     },
 *   ],
 *   commandSender: {
 *     async send(command) {
 *       const res = await fetch('/api/commands', {
 *         method: 'POST',
 *         headers: { 'Content-Type': 'application/json' },
 *         body: JSON.stringify({ type: command.type, payload: command.payload }),
 *       })
 *       if (!res.ok) throw new Error(`Command failed: ${res.status}`)
 *       return res.json()
 *     },
 *   },
 * })
 * ```
 *
 * @param config - Client configuration
 * @returns A fully initialized CQRS Client instance
 */
export async function createCqrsClient(config: CqrsClientConfig): Promise<CqrsClient> {
  const resolved = resolveConfig(config)
  const mode = resolveMode(resolved.mode)

  // 1. Create and initialize adapter
  const adapter = createAdapterForMode(mode, resolved)
  await adapter.initialize()

  // 2. Extract adapter resources
  const { storage, eventBus } = adapter

  // 3. Register event processors
  const registry = new EventProcessorRegistry()
  for (const registration of resolved.processors) {
    registry.register(registration)
  }

  // 4. Create core components
  const cacheManager = new CacheManager({
    storage,
    eventBus,
    cacheConfig: resolved.cache,
  })

  const eventCache = new EventCache({
    storage,
    eventBus,
  })

  const readModelStore = new ReadModelStore({
    storage,
    eventBus,
  })

  const eventProcessorRunner = new EventProcessorRunner({
    storage,
    eventBus,
    registry,
  })

  const commandQueue = new CommandQueue({
    storage,
    eventBus,
    domainExecutor: resolved.domainExecutor,
    commandSender: resolved.commandSender,
    retryConfig: resolved.retry,
    retainTerminal: resolved.retainTerminal,
    onCommandResponse: createCommandResponseHandler(cacheManager, eventProcessorRunner),
  })

  const queryManager = new QueryManager({
    eventBus,
    cacheManager,
    readModelStore,
  })

  const syncManager = new SyncManager({
    eventBus,
    sessionManager: adapter.sessionManager,
    commandQueue,
    eventCache,
    cacheManager,
    eventProcessor: eventProcessorRunner,
    networkConfig: resolved.network,
    collections: resolved.collections,
  })

  // 5. Start sync
  await syncManager.start()

  return new CqrsClient(
    adapter,
    cacheManager,
    commandQueue,
    syncManager,
    queryManager,
    eventCache,
    readModelStore,
    eventProcessorRunner,
    mode,
  )
}

/**
 * Resolve 'auto' mode to a concrete execution mode.
 */
function resolveMode(mode: ExecutionModeConfig): ExecutionMode {
  if (mode === 'auto') {
    return detectMode()
  }
  return mode
}

/**
 * Create the appropriate adapter for the given execution mode.
 */
function createAdapterForMode(mode: ExecutionMode, config: ResolvedConfig): IAdapter {
  switch (mode) {
    case 'online-only':
      return new OnlineOnlyAdapter(config)
    case 'shared-worker':
      assert(config.workerUrl, 'workerUrl is required for shared-worker mode')
      return new SharedWorkerAdapter({ ...config, workerUrl: config.workerUrl })
    case 'dedicated-worker':
      assert(config.workerUrl, 'workerUrl is required for dedicated-worker mode')
      return new DedicatedWorkerAdapter({ ...config, workerUrl: config.workerUrl })
    case 'main-thread':
      return new MainThreadAdapter(config)
  }
}

// ---------------------------------------------------------------------------
// Command response event processing
// ---------------------------------------------------------------------------

/**
 * Shape of an individual event inside a command response.
 */
interface ResponseEvent {
  id: string
  type: string
  streamId: string
  data: unknown
  revision?: string
}

/**
 * Type guard: does the response carry an `events` array with the fields we need?
 */
function hasResponseEvents(response: unknown): response is { events: ResponseEvent[] } {
  if (typeof response !== 'object' || response === null) return false
  if (!('events' in response)) return false
  const { events } = response as { events: unknown }
  return Array.isArray(events)
}

/**
 * Type guard for an individual response event object.
 */
function isResponseEvent(value: unknown): value is ResponseEvent {
  if (typeof value !== 'object' || value === null) return false
  const obj = value as Record<string, unknown>
  return (
    typeof obj['id'] === 'string' &&
    typeof obj['type'] === 'string' &&
    typeof obj['streamId'] === 'string' &&
    'data' in obj
  )
}

/**
 * Extract collection name from a streamId.
 * Convention: streamId = "{collection}-{id}" (e.g., "todo-123").
 */
function collectionFromStreamId(streamId: string): string | null {
  const idx = streamId.indexOf('-')
  if (idx < 1) return null
  return streamId.slice(0, idx)
}

/**
 * Build the `onCommandResponse` callback wired into the CommandQueue.
 *
 * For each valid event in the response, derives the collection, acquires a
 * cache key, and processes the event through the event processor runner so
 * the read model is up-to-date before the command is marked as succeeded.
 */
function createCommandResponseHandler(
  cacheManager: CacheManager,
  eventProcessorRunner: EventProcessorRunner,
): (command: CommandRecord, response: unknown) => Promise<void> {
  return async (command: CommandRecord, response: unknown) => {
    if (!hasResponseEvents(response)) return

    const events = response.events
    if (events.length === 0) return

    for (const raw of events) {
      if (!isResponseEvent(raw)) continue

      const collection = collectionFromStreamId(raw.streamId)
      if (!collection) {
        logProvider.log.warn(
          { streamId: raw.streamId, commandId: command.commandId },
          'Could not derive collection from streamId in command response',
        )
        continue
      }

      const cacheKey = await cacheManager.acquire(collection)

      const parsed: ParsedEvent = {
        id: raw.id,
        type: raw.type,
        streamId: raw.streamId,
        persistence: 'Permanent',
        data: raw.data,
        commandId: command.commandId,
        revision: raw.revision,
        cacheKey,
      }

      await eventProcessorRunner.processEvent(parsed)
    }
  }
}
