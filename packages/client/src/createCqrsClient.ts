/**
 * Public entry point for the CQRS Client library.
 *
 * Provides an async factory function that wires all internal components together
 * and returns an initialized {@link CqrsClient} instance.
 *
 * Two paths:
 * - **Online-only**: adapter provides storage/eventBus/sessionManager, this module
 *   creates all CQRS components on the main thread.
 * - **Worker modes**: adapter sends config to the worker which creates all components;
 *   this module wraps the adapter's proxy objects.
 *
 * @packageDocumentation
 */

import { Err, Ok, logProvider } from '@meticoeus/ddd-es'
import { type Observable, filter } from 'rxjs'
import type {
  AdapterStatus,
  IAdapter,
  IOnlineOnlyAdapter,
  IWorkerAdapter,
} from './adapters/base/IAdapter.js'
import { DedicatedWorkerAdapter } from './adapters/dedicated-worker/DedicatedWorkerAdapter.js'
import { OnlineOnlyAdapter } from './adapters/online-only/OnlineOnlyAdapter.js'
import { SharedWorkerAdapter } from './adapters/shared-worker/SharedWorkerAdapter.js'
import { OpfsUnavailableException } from './adapters/worker-core/probeOpfs.js'
import { CacheManager } from './core/cache-manager/CacheManager.js'
import type { ICacheManager } from './core/cache-manager/types.js'
import type { IAnticipatedEventHandler } from './core/command-queue/CommandQueue.js'
import { CommandQueue } from './core/command-queue/CommandQueue.js'
import type { ICommandQueue } from './core/command-queue/types.js'
import { detectMode, readModeCache, writeModeCache } from './core/detectMode.js'
import { EventCache } from './core/event-cache/EventCache.js'
import { EventProcessorRegistry } from './core/event-processor/EventProcessorRegistry.js'
import type { ParsedEvent } from './core/event-processor/EventProcessorRunner.js'
import { EventProcessorRunner } from './core/event-processor/EventProcessorRunner.js'
import { QueryManager } from './core/query-manager/QueryManager.js'
import { StableRefQueryManager } from './core/query-manager/StableRefQueryManager.js'
import type { IQueryManager } from './core/query-manager/types.js'
import { ReadModelStore } from './core/read-model-store/ReadModelStore.js'
import type { IConnectivity } from './core/sync-manager/ConnectivityManager.js'
import type { CollectionSyncStatus } from './core/sync-manager/SyncManager.js'
import { SyncManager } from './core/sync-manager/SyncManager.js'
import type {
  CommandRecord,
  EnqueueCommand,
  SubmitOptions,
  SubmitResult,
  SubmitSuccess,
  TerminalCommandStatus,
} from './types/commands.js'
import { SubmitException } from './types/commands.js'
import type {
  Collection,
  CqrsClientConfig,
  ExecutionMode,
  ExecutionModeConfig,
  ResolvedConfig,
} from './types/config.js'
import { resolveConfig } from './types/config.js'
import type { EventPersistence, LibraryEvent } from './types/events.js'
import { DEBUG_EVENT_TYPES } from './types/events.js'
import { assert } from './utils/assert.js'

/**
 * Restricted view of SyncManager exposed to consumers.
 * Start/stop are managed internally by the client lifecycle.
 */
export interface CqrsClientSyncManager {
  /** Get sync status for a specific collection. */
  getCollectionStatus(collection: string): CollectionSyncStatus | undefined
  /** Get sync status for all collections. */
  getAllStatus(): CollectionSyncStatus[]
  /** Force-sync a specific collection from the server. */
  syncCollection(collection: string): Promise<void>
  /** Signal that the user has been authenticated. */
  setAuthenticated(params: { userId: string }): Promise<{ resumed: boolean }>
  /** Signal that the user has logged out. */
  setUnauthenticated(): Promise<void>
  /** Connectivity manager for network status observation. */
  readonly connectivity: IConnectivity
}

/**
 * CQRS Client instance returned by {@link createCqrsClient}.
 *
 * All fields are available immediately — the client is fully initialized at construction time.
 */
export class CqrsClient {
  /** Cache manager for cache key lifecycle and eviction. */
  readonly cacheManager: ICacheManager
  /** Command queue for enqueuing and tracking commands. */
  readonly commandQueue: ICommandQueue
  /** Query manager for reading cached data. */
  readonly queryManager: IQueryManager
  /** Sync manager for collection sync status and manual triggers. */
  readonly syncManager: CqrsClientSyncManager
  /** Resolved execution mode. */
  readonly mode: ExecutionMode

  private readonly adapter: IAdapter
  private readonly closeResources: () => Promise<void>
  private readonly _events$: Observable<LibraryEvent>

  constructor(
    adapter: IAdapter,
    cacheManager: ICacheManager,
    commandQueue: ICommandQueue,
    queryManager: IQueryManager,
    syncManager: CqrsClientSyncManager,
    closeResources: () => Promise<void>,
    mode: ExecutionMode,
    debug: boolean,
  ) {
    this.adapter = adapter
    this.cacheManager = cacheManager
    this.commandQueue = commandQueue
    this.queryManager = queryManager
    this.syncManager = syncManager
    this.closeResources = closeResources
    this.mode = mode
    this._events$ = debug
      ? this.adapter.events$
      : this.adapter.events$.pipe(filter((e) => !DEBUG_EVENT_TYPES.has(e.type)))
  }

  /**
   * Network-aware command submission.
   *
   * When online+authenticated: waits for server confirmation (like `enqueueAndWait`).
   * When offline/unauthenticated: returns after enqueue (like `enqueue`).
   *
   * If `options.commandId` is provided, checks the queue first:
   * - Found + non-terminal → resumes waiting (no duplicate enqueue)
   * - Found + succeeded → returns cached success immediately
   * - Found + failed/cancelled, or not found → fresh enqueue
   */
  async submit<TPayload, TResponse>(
    command: EnqueueCommand<TPayload>,
    options?: SubmitOptions,
  ): Promise<SubmitResult<TResponse>> {
    let commandId = options?.commandId

    // Step 1: If commandId provided, check queue for existing command
    if (commandId) {
      const existing = await this.commandQueue.getCommand(commandId)
      if (existing) {
        switch (existing.status) {
          case 'succeeded':
            // Already confirmed — return cached success
            return Ok({
              stage: 'confirmed',
              commandId,
              response: existing.serverResponse as TResponse,
            } satisfies SubmitSuccess<TResponse>)

          case 'pending':
          case 'blocked':
          case 'sending':
            // Non-terminal — skip enqueue, resume at connectivity check (step 4)
            return this.submitWaitOrReturn(commandId, options?.timeout)

          case 'failed':
          case 'cancelled':
            // Terminal failure — fresh enqueue with new commandId
            commandId = undefined
            break
        }
      }
    }

    // Step 2: Enqueue the command
    const enqueueResult = await this.commandQueue.enqueue(command, {
      skipValidation: options?.skipValidation,
      commandId,
    })

    // Step 3: If validation fails, return error with no commandId
    if (!enqueueResult.ok) {
      const errors = enqueueResult.error.details ?? []
      return Err(new SubmitException(errors, 'local'))
    }

    const resolvedCommandId = enqueueResult.value.commandId

    // Steps 4-6: Check connectivity, wait or return
    return this.submitWaitOrReturn(resolvedCommandId, options?.timeout)
  }

  /**
   * Steps 4-6 of submit: check connectivity, return enqueued or wait for completion.
   */
  private async submitWaitOrReturn<TResponse>(
    commandId: string,
    timeout?: number,
  ): Promise<SubmitResult<TResponse>> {
    // Step 4: Check connectivity
    const online = this.syncManager.connectivity.isOnline()

    // Step 5: If offline, return enqueued immediately
    if (!online) {
      return Ok({ stage: 'enqueued', commandId } satisfies SubmitSuccess<TResponse>)
    }

    // Step 6: Online — wait for completion
    const completion = await this.commandQueue.waitForCompletion(commandId, { timeout })

    switch (completion.status) {
      case 'succeeded':
        return Ok({
          stage: 'confirmed',
          commandId,
          response: completion.response as TResponse,
        } satisfies SubmitSuccess<TResponse>)

      case 'failed': {
        const errors = completion.error.validationErrors ?? [
          { path: '_', message: completion.error.message },
        ]
        return Err(new SubmitException(errors, completion.error.source, commandId))
      }

      case 'cancelled':
        return Err(
          new SubmitException([{ path: '_', message: 'Command cancelled' }], 'local', commandId),
        )

      case 'timeout': {
        // Check if we went offline during the wait
        const stillOnline = this.syncManager.connectivity.isOnline()
        if (!stillOnline) {
          return Ok({ stage: 'enqueued', commandId } satisfies SubmitSuccess<TResponse>)
        }
        return Err(
          new SubmitException([{ path: '_', message: 'Command timed out' }], 'local', commandId),
        )
      }
    }
  }

  /** Observable of all library events. */
  get events$(): Observable<LibraryEvent> {
    return this._events$
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
    await this.closeResources()
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
  const requestedMode = config.mode ?? 'auto'

  // 1. Create and initialize adapter (with OPFS fallback for auto mode)
  const { adapter, mode } = await initializeAdapter(
    requestedMode,
    config.workerUrl,
    config.sqliteWorkerUrl,
    resolved,
  )

  // Two paths based on adapter type
  try {
    if (adapter.mode === 'online-only') {
      return createOnlineOnlyClient(adapter, resolved, mode)
    }
    return createWorkerClient(adapter, mode, resolved.debug)
  } catch (error) {
    await adapter.close()
    throw error
  }
}

/**
 * Online-only path: create all CQRS components on the main thread.
 */
async function createOnlineOnlyClient(
  adapter: IOnlineOnlyAdapter,
  resolved: ResolvedConfig,
  mode: ExecutionMode,
): Promise<CqrsClient> {
  const { storage, eventBus } = adapter

  // Register event processors
  const registry = new EventProcessorRegistry()
  for (const registration of resolved.processors) {
    registry.register(registration)
  }

  // Create core components
  const cacheManager = new CacheManager({
    storage,
    eventBus,
    cacheConfig: resolved.cache,
    windowId: crypto.randomUUID(),
  })
  await cacheManager.initialize()

  const eventCache = new EventCache({
    storage,
    eventBus,
  })

  const readModelStore = new ReadModelStore({
    storage,
  })

  const eventProcessorRunner = new EventProcessorRunner({
    readModelStore,
    eventBus,
    registry,
  })

  // Lazy ref for SyncManager — safe because onCommandResponse is never called
  // before SyncManager exists (queue starts paused, only processes after resume).
  let syncManagerRef: SyncManager

  const commandQueue = new CommandQueue({
    storage,
    eventBus,
    anticipatedEventHandler: createAnticipatedEventHandler(
      eventCache,
      cacheManager,
      eventProcessorRunner,
      readModelStore,
      resolved.collections,
    ),
    domainExecutor: resolved.domainExecutor,
    commandSender: resolved.commandSender,
    retryConfig: resolved.retry,
    retainTerminal: resolved.retainTerminal,
    onCommandResponse: createCommandResponseHandler(
      () => syncManagerRef,
      cacheManager,
      resolved.collections,
    ),
  })

  const queryManager = new QueryManager({
    eventBus,
    cacheManager,
    readModelStore,
  })

  const stableQueryManager = new StableRefQueryManager(queryManager)

  const syncManager = new SyncManager({
    eventBus,
    sessionManager: adapter.sessionManager,
    commandQueue,
    eventCache,
    cacheManager,
    eventProcessor: eventProcessorRunner,
    readModelStore,
    queryManager,
    networkConfig: resolved.network,
    collections: resolved.collections,
  })
  syncManagerRef = syncManager

  // Subscribe to cache:evicted for cross-component cleanup
  const evictionSubscription = eventBus.on('cache:evicted').subscribe((event) => {
    const streamIds = eventCache.clearByCacheKey(event.payload.cacheKey)
    syncManager.clearKnownRevisions(streamIds)
    queryManager.releaseForCacheKey(event.payload.cacheKey)
  })

  // Build sync manager facade
  const syncManagerFacade: CqrsClientSyncManager = {
    getCollectionStatus: (collection) => syncManager.getCollectionStatus(collection),
    getAllStatus: () => syncManager.getAllStatus(),
    syncCollection: (collection) => syncManager.syncCollection(collection),
    setAuthenticated: (params) => syncManager.setAuthenticated(params),
    setUnauthenticated: () => syncManager.setUnauthenticated(),
    get connectivity() {
      return syncManager.getConnectivity()
    },
  }

  // Start sync
  await syncManager.start()

  // Resource cleanup for online-only mode
  const closeResources = async (): Promise<void> => {
    evictionSubscription.unsubscribe()
    eventCache.destroy()
    await syncManager.destroy()
    await stableQueryManager.destroy()
    await commandQueue.destroy()
  }

  return new CqrsClient(
    adapter,
    cacheManager,
    commandQueue,
    stableQueryManager,
    syncManagerFacade,
    closeResources,
    mode,
    resolved.debug,
  )
}

/**
 * Worker path: wrap the adapter's proxy objects.
 * All components live in the worker — this side is thin.
 */
function createWorkerClient(
  adapter: IWorkerAdapter,
  mode: ExecutionMode,
  debug: boolean,
): CqrsClient {
  const { commandQueue, cacheManager, syncManager } = adapter
  const stableQueryManager = new StableRefQueryManager(adapter.queryManager)

  // Resource cleanup for worker mode — proxies that have local state
  const closeResources = async (): Promise<void> => {
    // CommandQueueProxy and SyncManagerProxy have RxJS subjects to clean up.
    // QueryManagerProxy and CacheManagerProxy are stateless RPC wrappers.
    // The adapter's close() tells the worker to shut down all real components.
    // StableRefQueryManager clears its ref cache.
    await stableQueryManager.destroy()
  }

  return new CqrsClient(
    adapter,
    cacheManager,
    commandQueue,
    stableQueryManager,
    syncManager,
    closeResources,
    mode,
    debug,
  )
}

/**
 * Create, initialize, and return an adapter with the achieved execution mode.
 *
 * For `'auto'` mode: reads mode cache first (§0.1.7), falls back to Stage 1
 * detection on miss, then writes cache after successful Stage 2 (adapter init).
 * If the worker adapter fails due to OPFS unavailability, falls back to
 * online-only transparently. For explicit modes: propagates all errors.
 */
async function initializeAdapter(
  requestedMode: ExecutionModeConfig,
  workerUrl: string | undefined,
  sqliteWorkerUrl: string | undefined,
  config: ResolvedConfig,
): Promise<{ adapter: IAdapter; mode: ExecutionMode }> {
  let mode: ExecutionMode

  if (requestedMode === 'auto') {
    const cached = readModeCache()
    mode = cached ?? detectMode()
  } else {
    mode = requestedMode
  }

  const adapter = createAdapterForMode(mode, workerUrl, sqliteWorkerUrl, config)

  try {
    await adapter.initialize()

    // Write mode cache after successful Stage 2 (auto mode only)
    if (requestedMode === 'auto' && mode !== 'online-only') {
      writeModeCache(mode)
    }

    return { adapter, mode }
  } catch (error) {
    // Only fall back for auto mode when a worker mode failed due to OPFS
    if (requestedMode === 'auto' && error instanceof OpfsUnavailableException) {
      await adapter.close().catch(() => {})
      const fallback = createAdapterForMode('online-only', undefined, undefined, config)
      await fallback.initialize()
      return { adapter: fallback, mode: 'online-only' }
    }
    throw error
  }
}

/**
 * Create the appropriate adapter for the given execution mode.
 */
function createAdapterForMode(
  mode: ExecutionMode,
  workerUrl: string | undefined,
  sqliteWorkerUrl: string | undefined,
  config: ResolvedConfig,
): IAdapter {
  switch (mode) {
    case 'online-only':
      return new OnlineOnlyAdapter(config)
    case 'shared-worker':
      assert(workerUrl, 'workerUrl is required for shared-worker mode')
      assert(sqliteWorkerUrl, 'sqliteWorkerUrl is required for shared-worker mode')
      return new SharedWorkerAdapter({
        workerUrl,
        sqliteWorkerUrl,
        requestTimeout: config.network.timeout,
      })
    case 'dedicated-worker':
      assert(workerUrl, 'workerUrl is required for dedicated-worker mode')
      return new DedicatedWorkerAdapter({
        workerUrl,
        requestTimeout: config.network.timeout,
      })
  }
}

// ---------------------------------------------------------------------------
// Anticipated event handling
// ---------------------------------------------------------------------------

/**
 * Shape of an anticipated event produced by the domain executor.
 */
interface AnticipatedEventShape {
  type: string
  data: unknown
  streamId: string
}

/**
 * Type guard: does a value look like an anticipated event with required fields?
 */
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

/**
 * Build the `IAnticipatedEventHandler` wired into the CommandQueue.
 *
 * For each valid anticipated event, finds the matching collection via matchesStream,
 * acquires a cache key, stores via EventCache, then sends through the event processor
 * pipeline with `persistence: 'Anticipated'`.
 *
 * Tracks which entities were updated by each command's anticipated events. On failure
 * or cancellation, reverts those read models to their server baseline.
 */
function createAnticipatedEventHandler(
  eventCache: EventCache,
  cacheManager: CacheManager,
  eventProcessorRunner: EventProcessorRunner,
  readModelStore: ReadModelStore,
  collections: Collection[],
): IAnticipatedEventHandler {
  /** commandId → ["collection:id", ...] tracking which entities were optimistically updated. */
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
      // Always delete anticipated events from EventCache
      await eventCache.deleteAnticipatedEvents(commandId)

      const tracked = anticipatedUpdates.get(commandId)
      anticipatedUpdates.delete(commandId)

      // Revert read models on failure or cancellation
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
  persistence?: EventPersistence
  revision: string
  position: string
}

/**
 * Type guard: does the response carry an `events` array with the fields we need?
 */
function hasResponseEvents(response: unknown): response is { events: ResponseEvent[] } {
  if (typeof response !== 'object' || response === null) return false
  if (!('events' in response)) return false
  return Array.isArray(response.events)
}

/**
 * Type guard for an individual response event object.
 */
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

/**
 * Build the `onCommandResponse` callback wired into the CommandQueue.
 *
 * For each valid event in the response, finds the matching collection via
 * matchesStream, acquires a cache key, converts to ParsedEvent, and routes
 * through SyncManager.processResponseEvents() for gap-aware processing and
 * WS dedup.
 *
 * Uses a lazy SyncManager reference because CommandQueue is created before
 * SyncManager. The lazy ref is safe because onCommandResponse is never called
 * before SyncManager exists (queue starts paused, only processes after resume).
 */
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
