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

import { Err, Ok, type Link } from '@meticoeus/ddd-es'
import type { Observable } from 'rxjs'
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
import type { CacheKeyIdentity } from './core/cache-manager/CacheKey.js'
import { CacheManager } from './core/cache-manager/CacheManager.js'
import type { ICacheManager } from './core/cache-manager/types.js'
import { AnticipatedEventHandler } from './core/command-lifecycle/AnticipatedEventHandler.js'
import type { IAnticipatedEvent } from './core/command-lifecycle/AnticipatedEventShape.js'
import { createCommandResponseHandler } from './core/command-lifecycle/createCommandResponseHandler.js'
import { CommandQueue } from './core/command-queue/CommandQueue.js'
import type { ICommandQueue } from './core/command-queue/types.js'
import { detectMode, readModeCache, writeModeCache } from './core/detectMode.js'
import { EventCache } from './core/event-cache/EventCache.js'
import { EventProcessorRegistry } from './core/event-processor/EventProcessorRegistry.js'
import { EventProcessorRunner } from './core/event-processor/EventProcessorRunner.js'
import { QueryManager } from './core/query-manager/QueryManager.js'
import { StableRefQueryManager } from './core/query-manager/StableRefQueryManager.js'
import type { IQueryManager } from './core/query-manager/types.js'
import { ReadModelStore } from './core/read-model-store/ReadModelStore.js'
import type { IConnectivity } from './core/sync-manager/ConnectivityManager.js'
import type { CollectionSyncStatus } from './core/sync-manager/SeedStatusIndex.js'
import { SyncManager } from './core/sync-manager/SyncManager.js'
import { WriteQueue } from './core/write-queue/WriteQueue.js'
import type { EnqueueCommand, SubmitParams, SubmitResult, SubmitSuccess } from './types/commands.js'
import { SubmitException } from './types/commands.js'
import type {
  CqrsClientConfig,
  ExecutionMode,
  ExecutionModeConfig,
  ResolvedConfig,
} from './types/config.js'
import { resolveConfig } from './types/config.js'
import type { CqrsDevToolsHook, DebugStorageAPI } from './types/debug.js'
import { createDomainExecutor } from './types/domain.js'
import type { LibraryEvent } from './types/events.js'
import { assert } from './utils/assert.js'

/**
 * Window type augmentation for devtools hook detection.
 */
interface WindowWithDevtools<
  TLink extends Link,
  TSchema,
  TEvent extends IAnticipatedEvent,
> extends Window {
  __CQRS_TOOLKIT_DEVTOOLS__?: CqrsDevToolsHook<TLink, TSchema, TEvent>
}

/**
 * Restricted view of SyncManager exposed to consumers.
 * Start/stop are managed internally by the client lifecycle.
 */
export interface CqrsClientSyncManager<TLink extends Link> {
  /** Get sync status for a specific collection. */
  getCollectionStatus(collection: string): CollectionSyncStatus | undefined
  /** Get sync status for all collections. */
  getAllStatus(): CollectionSyncStatus[]
  /** Force-sync a specific collection from the server. */
  syncCollection(collection: string): Promise<void>
  /** Get the aggregate seed status for a cache key identity. */
  getSeedStatus(cacheKey: CacheKeyIdentity<TLink>): Promise<'seeded' | 'seeding' | 'unseeded'>
  /** Seed all collections whose keyTypes match the given cache key identity. */
  seed(cacheKey: CacheKeyIdentity<TLink>): Promise<void>
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
export class CqrsClient<TLink extends Link, TCommand extends EnqueueCommand = EnqueueCommand> {
  /** Cache manager for cache key lifecycle and eviction. */
  readonly cacheManager: ICacheManager<TLink>
  /** Command queue for enqueuing and tracking commands. */
  readonly commandQueue: ICommandQueue<TLink>
  /** Query manager for reading cached data. */
  readonly queryManager: IQueryManager<TLink>
  /** Sync manager for collection sync status and manual triggers. */
  readonly syncManager: CqrsClientSyncManager<TLink>
  /** Resolved execution mode. */
  readonly mode: ExecutionMode

  private readonly adapter: IAdapter<TLink>
  private readonly closeResources: () => Promise<void>

  constructor(
    adapter: IAdapter<TLink>,
    cacheManager: ICacheManager<TLink>,
    commandQueue: ICommandQueue<TLink>,
    queryManager: IQueryManager<TLink>,
    syncManager: CqrsClientSyncManager<TLink>,
    closeResources: () => Promise<void>,
    mode: ExecutionMode,
  ) {
    this.adapter = adapter
    this.cacheManager = cacheManager
    this.commandQueue = commandQueue
    this.queryManager = queryManager
    this.syncManager = syncManager
    this.closeResources = closeResources
    this.mode = mode
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
  async submit<TResponse = unknown>(
    params: SubmitParams<TLink, TCommand>,
  ): Promise<SubmitResult<TResponse>> {
    const { command, cacheKey, skipValidation, timeout } = params
    let commandId = params.commandId

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
            return this.submitWaitOrReturn(commandId, timeout)

          case 'failed':
          case 'cancelled':
            // Terminal failure — fresh enqueue with new commandId
            commandId = undefined
            break
        }
      }
    }

    // Step 2: Enqueue the command
    const enqueueResult = await this.commandQueue.enqueue({
      command,
      skipValidation,
      commandId,
      cacheKey,
    })

    // Step 3: If validation fails, return error with no commandId
    if (!enqueueResult.ok) {
      const errors = enqueueResult.error.details ?? []
      return Err(new SubmitException(errors, 'local'))
    }

    const resolvedCommandId = enqueueResult.value.commandId

    // Steps 4-6: Check connectivity, wait or return
    return this.submitWaitOrReturn(resolvedCommandId, timeout)
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

  /**
   * Get entity IDs that were created or updated by a command's anticipated events.
   *
   * @param commandId - The command ID (from SubmitSuccess.commandId)
   * @param collection - Optional collection filter. When provided, only returns
   *   entities from that collection.
   * @returns Array of entity IDs. Empty if the command has no tracked entries
   *   (e.g., already reached terminal state and was cleaned up).
   */
  async getCommandEntities(commandId: string, collection?: string): Promise<string[]> {
    return this.commandQueue.getCommandEntities(commandId, collection)
  }

  /**
   * Seed all collections whose keyTypes match the given cache key identity.
   * Acquires the cache key if needed and waits for all matching collections to settle.
   *
   * - If already seeded, returns immediately.
   * - If unseeded, acquires the cache key (which triggers seeding via events) then waits.
   * - If seeding is in progress, waits for settlement.
   * - If settlement fails, throws with collection-level error details.
   *
   * @param cacheKey - Cache key identity to seed for
   */
  async seed(cacheKey: CacheKeyIdentity<TLink>): Promise<void> {
    await this.syncManager.seed(cacheKey)
  }

  /** Observable of all library events. */
  get events$(): Observable<LibraryEvent<TLink>> {
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
 *   collections: [{ name: 'todos' }],
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
 *         body: JSON.stringify({ type: command.type, data: command.data }),
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
export async function createCqrsClient<
  TLink extends Link,
  TSchema = unknown,
  TEvent extends IAnticipatedEvent = IAnticipatedEvent,
>(config: CqrsClientConfig<TLink, TSchema, TEvent>): Promise<CqrsClient<TLink>> {
  const resolved = resolveConfig(config)
  const requestedMode = config.mode ?? 'auto'

  // 1. Create and initialize adapter (with OPFS fallback for auto mode)
  const { adapter, mode } = await initializeAdapter<TLink, TSchema, TEvent>(
    requestedMode,
    config.workerUrl,
    config.sqliteWorkerUrl,
    resolved,
  )

  // Two paths based on adapter type
  let client: CqrsClient<TLink>
  try {
    if (adapter.mode === 'online-only') {
      client = await createOnlineOnlyClient<TLink, TSchema, TEvent>(adapter, resolved, mode)
    } else {
      client = await createWorkerClient<TLink>(adapter, mode, resolved.debug)
    }
  } catch (error) {
    await adapter.close()
    throw error
  }

  // Register debug API on window hook if available
  if (resolved.debug && typeof window !== 'undefined') {
    const hook = (window as WindowWithDevtools<TLink, TSchema, TEvent>).__CQRS_TOOLKIT_DEVTOOLS__
    if (hook) {
      let debugStorage: DebugStorageAPI | undefined
      if (adapter.mode !== 'online-only') {
        const workerAdapter = adapter
        debugStorage = {
          exec: (sql, bind) =>
            workerAdapter.debugQuery<Record<string, unknown>[]>('debug.storage.exec', [sql, bind]),
        }
      }

      hook.registerClient({
        events$: client.events$,
        commandQueue: client.commandQueue,
        queryManager: client.queryManager,
        cacheManager: client.cacheManager,
        syncManager: client.syncManager,
        storage: adapter.mode === 'online-only' ? adapter.storage : undefined,
        debugStorage,
        config: resolved,
        role: adapter.role ?? 'leader',
      })
    }
  }

  return client
}

/**
 * Online-only path: create all CQRS components on the main thread.
 */
async function createOnlineOnlyClient<
  TLink extends Link,
  TSchema,
  TEvent extends IAnticipatedEvent,
>(
  adapter: IOnlineOnlyAdapter<TLink>,
  resolved: ResolvedConfig<TLink, TSchema, TEvent>,
  mode: ExecutionMode,
): Promise<CqrsClient<TLink>> {
  const { storage, eventBus } = adapter

  // Register event processors
  const registry = new EventProcessorRegistry()
  for (const registration of resolved.processors) {
    registry.register(registration)
  }

  // Create core components
  const cacheManager = new CacheManager<TLink>({
    storage,
    eventBus,
    cacheConfig: resolved.cache,
    windowId: crypto.randomUUID(),
  })
  await cacheManager.initialize()

  const eventCache = new EventCache<TLink>({
    storage,
    eventBus,
  })

  const readModelStore = new ReadModelStore({
    storage,
  })

  const eventProcessorRunner = new EventProcessorRunner<TLink>(readModelStore, eventBus, registry)

  // Create WriteQueue — subsystems register their own handlers in their constructors.
  const writeQueue = new WriteQueue<TLink>()

  // Lazy ref for SyncManager — safe because onCommandResponse is never called
  // before SyncManager exists (queue starts paused, only processes after resume).
  let syncManagerRef: SyncManager<TLink, TSchema, TEvent>

  const anticipatedEventHandler = new AnticipatedEventHandler(
    eventCache,
    eventProcessorRunner,
    readModelStore,
    resolved.collections,
    writeQueue,
  )

  // Wire the anticipated handler into the processor for create reconciliation.
  // Breaks the circular dependency: handler needs runner, runner needs handler.
  eventProcessorRunner.setAnticipatedEventHandler(anticipatedEventHandler)

  const queryManager = new QueryManager<TLink>({
    eventBus,
    cacheManager,
    readModelStore,
  })

  const commandQueue = new CommandQueue<TLink, TSchema, TEvent>({
    storage,
    eventBus,
    anticipatedEventHandler,
    ...(() => {
      if (resolved.commandHandlers.length === 0) return {}
      const executor = createDomainExecutor<TLink, TSchema, TEvent>(resolved.commandHandlers, {
        schemaValidator: resolved.schemaValidator,
        queryManager,
      })
      return { domainExecutor: executor, handlerMetadata: executor }
    })(),
    commandSender: resolved.commandSender,
    retryConfig: resolved.retry,
    retainTerminal: resolved.retainTerminal,
    onCommandResponse: createCommandResponseHandler<TLink, TSchema, TEvent>(
      () => syncManagerRef,
      resolved.collections,
    ),
  })

  const stableQueryManager = new StableRefQueryManager<TLink>(queryManager)

  const syncManager = new SyncManager<TLink, TSchema, TEvent>(
    eventBus,
    adapter.sessionManager,
    commandQueue,
    eventCache,
    cacheManager,
    eventProcessorRunner,
    readModelStore,
    queryManager,
    writeQueue,
    resolved.network,
    resolved.auth,
    resolved.collections,
  )
  syncManagerRef = syncManager

  // Build sync manager facade
  const syncManagerFacade: CqrsClientSyncManager<TLink> = {
    getCollectionStatus: (collection) => syncManager.getCollectionStatus(collection),
    getAllStatus: () => syncManager.getAllStatus(),
    getSeedStatus: (cacheKey) => Promise.resolve(syncManager.getSeedStatus(cacheKey)),
    syncCollection: (collection) => syncManager.syncCollection(collection),
    seed: (cacheKey) => syncManager.seed(cacheKey),
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
    writeQueue.destroy()
    eventCache.destroy()
    await syncManager.destroy()
    await stableQueryManager.destroy()
    await commandQueue.destroy()
  }

  return new CqrsClient<TLink>(
    adapter,
    cacheManager,
    commandQueue,
    stableQueryManager,
    syncManagerFacade,
    closeResources,
    mode,
  )
}

/**
 * Worker path: wrap the adapter's proxy objects.
 * All components live in the worker — this side is thin.
 *
 * If debug is enabled, sends a `debug.enable` RPC to the worker so it
 * starts emitting debug events. This is one-way and idempotent.
 */
async function createWorkerClient<TLink extends Link>(
  adapter: IWorkerAdapter<TLink>,
  mode: ExecutionMode,
  debug: boolean,
): Promise<CqrsClient<TLink>> {
  const { commandQueue, cacheManager, syncManager } = adapter
  const stableQueryManager = new StableRefQueryManager<TLink>(adapter.queryManager)

  // Enable debug in worker if requested
  if (debug) {
    await adapter.enableDebug()
  }

  // Resource cleanup for worker mode — proxies that have local state
  const closeResources = async (): Promise<void> => {
    // CommandQueueProxy and SyncManagerProxy have RxJS subjects to clean up.
    // QueryManagerProxy and CacheManagerProxy are stateless RPC wrappers.
    // The adapter's close() tells the worker to shut down all real components.
    // StableRefQueryManager clears its ref cache.
    await stableQueryManager.destroy()
  }

  return new CqrsClient<TLink>(
    adapter,
    cacheManager,
    commandQueue,
    stableQueryManager,
    syncManager,
    closeResources,
    mode,
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
async function initializeAdapter<TLink extends Link, TSchema, TEvent extends IAnticipatedEvent>(
  requestedMode: ExecutionModeConfig,
  workerUrl: string | undefined,
  sqliteWorkerUrl: string | undefined,
  config: ResolvedConfig<TLink, TSchema, TEvent>,
): Promise<{ adapter: IAdapter<TLink>; mode: ExecutionMode }> {
  let mode: ExecutionMode

  if (requestedMode === 'auto') {
    const cached = readModeCache()
    mode = cached ?? detectMode()
  } else {
    mode = requestedMode
  }

  const adapter = createAdapterForMode<TLink, TSchema, TEvent>(
    mode,
    workerUrl,
    sqliteWorkerUrl,
    config,
  )

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
      const fallback = createAdapterForMode<TLink, TSchema, TEvent>(
        'online-only',
        undefined,
        undefined,
        config,
      )
      await fallback.initialize()
      return { adapter: fallback, mode: 'online-only' }
    }
    throw error
  }
}

/**
 * Create the appropriate adapter for the given execution mode.
 */
function createAdapterForMode<TLink extends Link, TSchema, TEvent extends IAnticipatedEvent>(
  mode: ExecutionMode,
  workerUrl: string | undefined,
  sqliteWorkerUrl: string | undefined,
  config: ResolvedConfig<TLink, TSchema, TEvent>,
): IAdapter<TLink> {
  switch (mode) {
    case 'online-only':
      return new OnlineOnlyAdapter<TLink, TSchema, TEvent>(config)
    case 'shared-worker':
      assert(workerUrl, 'workerUrl is required for shared-worker mode')
      assert(sqliteWorkerUrl, 'sqliteWorkerUrl is required for shared-worker mode')
      return new SharedWorkerAdapter<TLink>({
        workerUrl,
        sqliteWorkerUrl,
        requestTimeout: config.network.timeout,
      })
    case 'dedicated-worker':
      assert(workerUrl, 'workerUrl is required for dedicated-worker mode')
      return new DedicatedWorkerAdapter<TLink>({
        workerUrl,
        requestTimeout: config.network.timeout,
      })
  }
}
