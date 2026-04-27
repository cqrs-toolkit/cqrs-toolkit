/**
 * Sync manager orchestrates data synchronization between client and server.
 *
 * Responsibilities:
 * - Coordinate collection seeding
 * - Handle WebSocket event streams
 * - Manage gap repair
 * - Trigger command processing
 */

import { generateId, noop } from '#utils'
import { parseServerMessage, serializeClientMessage } from '@cqrs-toolkit/realtime'
import type { IPersistedEvent } from '@meticoeus/ddd-es'
import { Link, Ok, Result, logProvider } from '@meticoeus/ddd-es'
import { Subject, Subscription, takeUntil } from 'rxjs'
import type { CachedEventRecord, CommandIdMappingRecord, IStorage } from '../../storage/IStorage.js'
import type { AggregateConfig, IClientAggregates } from '../../types/aggregates.js'
import type { CommandRecord } from '../../types/commands.js'
import type {
  Collection,
  CollectionWithSeedOnDemand,
  FetchContext,
  NetworkConfig,
} from '../../types/config.js'
import type { EntityId, EntityRef } from '../../types/entities.js'
import { createEntityRef, entityIdToString } from '../../types/entities.js'
import { hydrateSerializedEvent, normalizeEventPersistence } from '../../types/events.js'
import { EnqueueCommand, type IDomainExecutor } from '../../types/index.js'
import type { AuthStrategy } from '../auth.js'
import { type CacheKeyIdentity, matchesCacheKey } from '../cache-manager/CacheKey.js'
import type { ICacheManagerInternal } from '../cache-manager/types.js'
import type { ICommandIdMappingStore } from '../command-id-mapping-store/ICommandIdMappingStore.js'
import type { IAnticipatedEvent } from '../command-lifecycle/AnticipatedEventShape.js'
import { parseExpectedRevision } from '../command-queue/CommandQueue.js'
import { CommandQueue, IAnticipatedEventHandler } from '../command-queue/index.js'
import { deriveAffectedAggregates } from '../command-queue/utils.js'
import type { ICommandStore } from '../command-store/ICommandStore.js'
import { getAtPath } from '../entity-ref/ref-path.js'
import type { RewriteIdEntry } from '../entity-ref/rewrite-command.js'
import { rewriteCommandWithIdMap } from '../entity-ref/rewrite-command.js'
import type { CacheServerEventEntry, EventCache } from '../event-cache/EventCache.js'
import { EventProcessorRegistry } from '../event-processor/index.js'
import type { ProcessorContext, ProcessorResult } from '../event-processor/types.js'
import type { EventBus } from '../events/EventBus.js'
import type { IQueryManagerInternal } from '../query-manager/types.js'
import type {
  ReadModel,
  ReadModelMutation,
  ReadModelStore,
  RevisionMeta,
} from '../read-model-store/ReadModelStore.js'
import type { SessionManager } from '../session/SessionManager.js'
import { IWriteQueue, WriteQueueException } from '../write-queue/IWriteQueue.js'
import type {
  ApplyRecordsOp,
  ApplySeedEventsOp,
  ReconcileWsEventsOp,
} from '../write-queue/operations.js'
import { EvictCacheKeyOp } from '../write-queue/operations.js'
import { GapRepairCoordinator } from './GapRepairCoordinator.js'
import type { IConnectivityManager } from './IConnectivityManager.js'
import { InvalidationScheduler } from './InvalidationScheduler.js'
import { PrimaryCollectionResolver } from './PrimaryCollectionResolver.js'
import {
  type ReconcileInput,
  type ReconcileOutput,
  applyOp,
  reconcilePendingCommands,
  stateKey,
} from './reconcilePendingCommands.js'
import type { CollectionSyncStatus } from './SeedStatusIndex.js'
import { SeedStatusIndex } from './SeedStatusIndex.js'

/**
 * An incoming WS event queued for batched reconcile processing. Captured
 * synchronously when the event arrives; the cache keys are snapshotted at
 * capture time so later resolution changes don't race the drain.
 */
interface PendingWsEventEntry<TLink extends Link> {
  event: IPersistedEvent
  cacheKeys: CacheKeyIdentity<TLink>[]
}

/**
 * TempId → serverId resolution detected during server-event processing.
 * The `ref` is the original EntityRef that held the tempId before the
 * server event resolved it. Phase 6 uses `ref.commandId` to derive the
 * `commandType` stored in `CommandIdMappingRecord.data`.
 */
interface IdResolution<TLink extends Link> {
  serverId: string
  ref: EntityRef
  revision: bigint
  aggregate: AggregateConfig<TLink>
}

/**
 * Inputs to the shared reconcile-and-persist block. Every entry point
 * that introduces server state (WS events, command response events, gap
 * repair, seed events, record-based seeds/refetches) produces this
 * struct after applying its entry-point-specific writes, then hands it
 * to `reconcileAndPersist` for pending-command re-evaluation and
 * persistence.
 */
/**
 * One processor result staged by the entry-point-specific block (Phase 3 of
 * `reconcileFromWsEvents`, or per-record loop in `onApplyRecords`) for
 * deferred application during Phase 6 of {@link SyncManager.reconcileAndPersist}.
 *
 * The pipeline contract is "all reads up front, all writes at the end" so
 * the entry-point block records the WHAT (processor result + cache-key
 * association + revision metadata), and the persist phase decides the WHEN
 * — after id-resolution migrations have remapped any in-flight tempId rows
 * to their server ids.
 */
interface DeferredApplication {
  result: ProcessorResult
  cacheKey: string
  revisionMeta: RevisionMeta | undefined
}

interface ServerStateChangeResult<TLink extends Link> {
  /** `collection:entityId` keys whose server baseline was modified. */
  dirtyEntityKeys: Set<string>
  /** Post-mutation server baselines keyed by `collection:entityId`. */
  serverStateByKey: Map<string, object>
  /** Client overlay projection keyed by `collection:entityId`. */
  clientStateByKey: Map<string, object>
  /** Cache keys that should be associated with each entity at persist time. */
  cacheKeysByKey: Map<string, Set<string>>
  /** Entities already written to the store by the entry-point-specific block. */
  modifiedByCollection: Map<string, Set<string>>
  /**
   * Commands whose effects contributed to each collection's modifications.
   * Populated from `event.metadata.commandId` as events are staged and from
   * `updatedAnticipatedEvents` after Phase 5 re-runs. Drives the `commandIds`
   * field on `readmodel:updated` emits so consumers can wait on "read model
   * current for this command's events".
   */
  commandIdsByCollection: Map<string, Set<string>>
  /** TempId→serverId resolutions detected during server-event processing. */
  idMap: Map<string, IdResolution<TLink>>
  /** `collection:tempId` keys whose rows must migrate to `idMap`'s server id during persist. */
  tempIdsToDelete: Set<string>
  /** Read model records already loaded by the entry point (for merge + _clientMetadata lookup). */
  preloadedRecords: ReadonlyMap<string, ReadModel>
  /**
   * Processor results awaiting persistence. Phase 3 of the WS path and the
   * per-record loop in `onApplyRecords` push here instead of writing
   * directly — Phase 6 of `reconcileAndPersist` flushes the queue after
   * id-resolution migrations so a single persist phase owns every storage
   * write.
   */
  pendingApplications: DeferredApplication[]
}

/**
 * Sync manager.
 */
export class SyncManager<
  TLink extends Link,
  TCommand extends EnqueueCommand,
  TSchema,
  TEvent extends IAnticipatedEvent,
> {
  private readonly connectivity: IConnectivityManager<TLink>
  private readonly gapRepair: GapRepairCoordinator<TLink, TCommand>
  private readonly invalidationScheduler: InvalidationScheduler<TLink>
  private readonly primaryCollectionResolver: PrimaryCollectionResolver<
    TLink,
    TCommand,
    TSchema,
    TEvent
  >

  /** Mutable — recreated on each start() so takeUntil subscriptions work after stop()/start() cycles. */
  private destroy$ = new Subject<void>()

  private readonly seedStatus = new SeedStatusIndex()
  private wsConnection: WebSocket | undefined
  private subscriptions: Subscription[] = []
  private abortController: AbortController | undefined

  /** Single-flight guard for seedForKey — concurrent callers for the same cacheKey share one promise. */
  private readonly inFlightSeeds = new Map<string, Promise<void>>()

  /** Single-flight guard for startSync — prevents overlapping syncs and captures rejections. */
  private startSyncPromise: Promise<void> | undefined

  /** Active WS topic subscriptions per cache key. Used for reconnect re-subscribe and eviction unsubscribe. */
  private readonly topicsByCacheKey = new Map<string, Set<string>>()

  /** Highest applied revision per stream. Initialized during seeding, advanced on happy-path processing. */
  protected readonly knownRevisions = new Map<string, bigint>()

  /** True while setAuthenticated/setUnauthenticated is handling the wipe inline. */
  private sessionDestroyHandledInline = false

  /**
   * In-memory queue of incoming WS events awaiting batched reconcile.
   * Drained by `onReconcileWsEventsOp` via a reference swap: the op handler
   * captures the current array by reference and installs a fresh empty array
   * in one synchronous step, so new events arriving during the async drain
   * accumulate into the next batch without touching the in-flight one.
   *
   * Protected so test subclasses can push directly and bypass the WriteQueue
   * scheduling race that happens when `handleNewWsEvent` is called in a
   * test that also wants to drive the drain synchronously. Production code
   * should go through `handleNewWsEvent`.
   */
  protected pendingWsEvents: PendingWsEventEntry<TLink>[] = []

  /** True while a `reconcile-ws-events` op is already enqueued on the WriteQueue. */
  private wsReconcilePending = false

  constructor(
    private readonly eventBus: EventBus<TLink>,
    private readonly storage: IStorage<TLink, TCommand>,
    private readonly sessionManager: SessionManager<TLink, TCommand>,
    private readonly anticipatedEventHandler: IAnticipatedEventHandler<TLink, TCommand>,
    private readonly commandQueue: CommandQueue<TLink, TCommand, any, any>,
    private readonly eventCache: EventCache<TLink, TCommand>,
    private readonly cacheManager: ICacheManagerInternal<TLink>,
    private readonly eventProcessorRegistry: EventProcessorRegistry,
    private readonly readModelStore: ReadModelStore<TLink, TCommand>,
    private readonly queryManager: IQueryManagerInternal<TLink>,
    private readonly writeQueue: IWriteQueue<TLink, TCommand>,
    connectivity: IConnectivityManager<TLink>,
    private readonly networkConfig: NetworkConfig,
    private readonly auth: AuthStrategy,
    private readonly collections: Collection<TLink>[],
    private readonly clientAggregates: IClientAggregates<TLink>,
    private readonly domainExecutor: IDomainExecutor<TLink, TCommand, TSchema, TEvent> | undefined,
    private readonly commandStore: ICommandStore<TLink, TCommand>,
    private readonly mappingStore: ICommandIdMappingStore,
  ) {
    this.connectivity = connectivity
    this.primaryCollectionResolver = new PrimaryCollectionResolver(this.collections)

    // Initialize invalidation scheduler
    this.invalidationScheduler = new InvalidationScheduler(
      this.eventBus,
      this.cacheManager,
      this.seedStatus,
      this.collections,
      {
        getFetchContext: () => this.buildFetchContext(),
        onRefetch: (params) => this.seedOneCollection(params),
      },
    )

    // Initialize gap repair coordinator (shares knownRevisions by reference)
    this.gapRepair = new GapRepairCoordinator(
      this.knownRevisions,
      this.eventBus,
      this.eventCache,
      this.readModelStore,
      this.collections,
      this.connectivity,
      this.writeQueue,
      {
        getFetchContext: () => this.buildFetchContext(),
        onInvalidated: (collectionName, cacheKeys) =>
          this.invalidationScheduler.schedule(collectionName, cacheKeys),
        onProcessGapEvents: async (entries) => {
          const preloaded = await this.setupWsReconcileBatch(entries)
          await this.reconcileFromWsEvents(entries, preloaded)
        },
      },
    )

    // Initialize seed status for auto-seeded collections
    for (const collection of this.collections) {
      if (collection.seedOnInit?.cacheKey) {
        this.seedStatus.set(collection.name, collection.seedOnInit.cacheKey.key, {
          collection: collection.name,
          cacheKey: collection.seedOnInit.cacheKey.key,
          seeded: false,
          syncing: false,
        })
      }
    }

    // Configure the WriteQueue lifecycle and op handlers
    this.writeQueue.setSessionResetHandler(() => this.onSessionDestroyed())
    this.writeQueue.register('apply-records', this.onApplyRecords.bind(this))
    this.writeQueue.registerEviction('apply-records', noop)
    this.writeQueue.register('apply-seed-events', this.onApplySeedEvents.bind(this))
    this.writeQueue.registerEviction('apply-seed-events', noop)
    this.writeQueue.register('reconcile-ws-events', this.onReconcileWsEventsOp.bind(this))
    // If the op is evicted (session reset / destroy) before the handler runs,
    // reset the pending flag so a fresh op can be scheduled later once the
    // queue is usable again. Without this, the flag stays true forever and
    // `scheduleWsReconcile` silently no-ops for the lifetime of the instance.
    this.writeQueue.registerEviction('reconcile-ws-events', () => {
      this.wsReconcilePending = false
    })
    this.writeQueue.register('evict-cache-key', this.onEvictCacheKey.bind(this))
    this.writeQueue.registerEviction('evict-cache-key', noop)
  }

  /**
   * Start the sync manager.
   * Begins connectivity monitoring and initial sync.
   *
   * Offline-first startup contract: SessionManager.initialize() sets networkPaused=true,
   * so start() will not trigger sync until the consumer calls setAuthenticated().
   * This allows the app to render immediately from cached data while auth resolves.
   */
  public async start(): Promise<void> {
    // Recreate destroy$ so takeUntil subscriptions work after a stop()/start() cycle
    this.destroy$ = new Subject<void>()

    // Create a fresh AbortController for this lifecycle
    this.abortController = new AbortController()

    // Start connectivity monitoring
    this.connectivity.start()

    // Start periodic cleanup of processed cached events
    this.eventCache.startCleanup()

    // Subscribe to connectivity changes
    const connectivitySub = this.connectivity.online$
      .pipe(takeUntil(this.destroy$))
      .subscribe((online) => {
        if (online) {
          this.onOnline()
        } else {
          this.onOffline()
        }
      })
    this.subscriptions.push(connectivitySub)

    // Subscribe to session changes
    const sessionSub = this.eventBus
      .on('session:changed')
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.connectivity.isOnline()) {
          this.startSync().catch((err) => {
            logProvider.log.error({ err }, 'startSync failed (session:changed)')
          })
        }
      })
    this.subscriptions.push(sessionSub)

    // Subscribe to session destroyed — clean up sync state on logout.
    // When setAuthenticated/setUnauthenticated handle the wipe inline, the flag
    // prevents this subscription from triggering a redundant (racing) wipe.
    const destroyedSub = this.eventBus
      .on('session:destroyed')
      .pipe(takeUntil(this.destroy$))
      .subscribe((event) => {
        if (this.sessionDestroyHandledInline) return
        this.writeQueue.resetSession(event.data.reason).catch((err) => {
          logProvider.log.error({ err }, 'writeQueue.resetSession failed')
        })
      })
    this.subscriptions.push(destroyedSub)

    // Subscribe to cache key lifecycle events (§4.2.1)
    const keyAddedSub = this.eventBus
      .on('cache:key-added')
      .pipe(takeUntil(this.destroy$))
      .subscribe((event) => {
        // Event payloads use CacheKeyIdentity<Link> (widest type, events aren't generic).
        // The identity is structurally correct for TLink at runtime — the event was emitted
        // by CacheManager<TLink, TCommand> which produced the identity from a TLink-typed source.
        const ck = event.data.cacheKey as CacheKeyIdentity<TLink>
        this.onCacheKeyAdded(ck).catch((err) => {
          logProvider.log.error({ err }, 'onCacheKeyAdded failed')
        })
      })
    this.subscriptions.push(keyAddedSub)

    const keyEvictedSub = this.eventBus
      .on('cache:evicted')
      .pipe(takeUntil(this.destroy$))
      .subscribe((event) => {
        this.writeQueue.enqueue({ type: 'evict-cache-key', cacheKey: event.data.cacheKey.key })
      })
    this.subscriptions.push(keyEvictedSub)

    // Decoupled invalidation entry point. CommandQueue (and any other
    // future emitter) announces "refetch this aggregate" via the event
    // bus; the scheduler — which already owns streamId → collection
    // resolution and debounced refetch — receives the signal here.
    // Keeps emitters free of any scheduler reference.
    const invalidateRequestedSub = this.eventBus
      .on('sync:invalidate-requested')
      .pipe(takeUntil(this.destroy$))
      .subscribe((event) => {
        this.invalidationScheduler.invalidateAggregate(event.data)
      })
    this.subscriptions.push(invalidateRequestedSub)

    // Re-seed on cache:key-accessed for restart recovery — if the key exists in
    // storage (survived reload) but hasn't been seeded yet in this session,
    // treat it like a new key and seed matching collections.
    // TODO: §4.8 prioritize held > recent > frozen for restart re-seeding
    const keyAccessedSub = this.eventBus
      .on('cache:key-accessed')
      .pipe(takeUntil(this.destroy$))
      .subscribe((event) => {
        this.onCacheKeyAdded(event.data.cacheKey as CacheKeyIdentity<TLink>).catch((err) => {
          logProvider.log.error({ err }, 'onCacheKeyAccessed re-seed failed')
        })
      })
    this.subscriptions.push(keyAccessedSub)

    // If already online and authenticated, start sync
    if (this.connectivity.isOnline() && !this.sessionManager.isNetworkPaused()) {
      await this.startSync()
    }
  }

  /**
   * Stop the sync manager. Reversible — can call start() again after.
   * Terminates subscriptions, aborts in-flight fetches, disconnects WebSocket.
   * Connectivity monitoring is paused but not destroyed.
   */
  public async stop(): Promise<void> {
    this.destroy$.next()
    this.destroy$.complete()

    for (const sub of this.subscriptions) {
      sub.unsubscribe()
    }
    this.subscriptions = []

    // Abort in-flight fetches
    this.abortController?.abort()
    this.abortController = undefined

    // Cancel pending invalidation refetches
    this.invalidationScheduler.cancelAll()

    this.disconnectWebSocket()
    this.connectivity.stop()

    // Wait for in-flight async operations to settle.
    // allSettled because aborted fetches may reject — we want to wait for
    // settlement, not propagate errors that are already handled internally.
    if (this.startSyncPromise) {
      await this.startSyncPromise
    }
  }

  /**
   * Permanently destroy the sync manager. Not reversible.
   * Calls stop(), then destroys the connectivity manager.
   */
  public async destroy(): Promise<void> {
    await this.stop()
    this.connectivity.destroy()
  }

  /**
   * Get connectivity manager.
   */
  public getConnectivity(): IConnectivityManager<TLink> {
    return this.connectivity
  }

  /**
   * Get sync status for a specific (collection, cacheKey) pair.
   */
  public getCollectionStatus(
    collection: string,
    cacheKey: CacheKeyIdentity<TLink>,
  ): CollectionSyncStatus | undefined {
    return this.seedStatus.get(collection, cacheKey.key)
  }

  /**
   * Get all collection statuses.
   */
  public getAllStatus(): CollectionSyncStatus[] {
    return Array.from(this.seedStatus.values())
  }

  /**
   * Force sync a specific collection.
   */
  /**
   * Get the aggregate seed status for a cache key identity.
   * Checks all collections whose keyTypes match the identity.
   *
   * - 'seeded': all matching collections are seeded for this key
   * - 'seeding': at least one matching collection is currently syncing
   * - 'unseeded': no status entries or some not yet started
   */
  public getSeedStatus(cacheKey: CacheKeyIdentity<TLink>): 'seeded' | 'seeding' | 'unseeded' {
    const matching = this.collections.filter((c) =>
      c.seedOnDemand?.keyTypes.some((matcher) => matchesCacheKey(cacheKey, matcher)),
    )
    if (matching.length === 0) return 'unseeded'

    const allSeeded = matching.every((c) => {
      const status = this.seedStatus.get(c.name, cacheKey.key)
      return status?.seeded === true
    })
    if (allSeeded) return 'seeded'

    const anySyncing = matching.some((c) => {
      const status = this.seedStatus.get(c.name, cacheKey.key)
      return status?.syncing === true
    })
    if (anySyncing) return 'seeding'

    return 'unseeded'
  }

  /**
   * Seed all collections whose keyTypes match the given cache key identity.
   *
   * Full lifecycle:
   * - If already seeded → returns immediately
   * - If unseeded → acquires the key (triggering seeding via events), then waits for settlement
   * - If seeding is in progress → waits for settlement
   * - If settlement fails → throws
   *
   * @param cacheKey - Cache key identity to seed for
   */
  public async seed(cacheKey: CacheKeyIdentity<TLink>): Promise<void> {
    const status = this.getSeedStatus(cacheKey)
    if (status === 'seeded') return

    if (status === 'unseeded') {
      // Acquire the key — this emits cache:key-added, which triggers onCacheKeyAdded → seedForKey
      await this.cacheManager.acquireKey(cacheKey)
    }

    // Wait for the aggregate settlement event for this cache key
    await this.seedForKey(cacheKey)

    // Check final status — throw if not all collections seeded
    const finalStatus = this.getSeedStatus(cacheKey)
    if (finalStatus !== 'seeded') {
      throw new Error(`Seed failed for cache key ${cacheKey.key}`)
    }
  }

  /**
   * Internal: seed all matching collections for a cache key identity.
   * Assumes the key is already acquired in storage.
   * Called by event handlers (onCacheKeyAdded, onCacheKeyAccessed) and by seed().
   * Emits cache:seed-settled when all matching collections have settled.
   *
   * @param cacheKey - Cache key identity to seed for
   */
  public seedForKey(cacheKey: CacheKeyIdentity<TLink>): Promise<void> {
    const existing = this.inFlightSeeds.get(cacheKey.key)
    if (existing) return existing
    const promise = this.runSeedForKey(cacheKey).finally(() => {
      this.inFlightSeeds.delete(cacheKey.key)
    })
    this.inFlightSeeds.set(cacheKey.key, promise)
    return promise
  }

  private async runSeedForKey(cacheKey: CacheKeyIdentity<TLink>): Promise<void> {
    const matchingCollections = this.collections.filter(
      (c): c is CollectionWithSeedOnDemand<TLink> =>
        !!c.seedOnDemand?.keyTypes.some((matcher) => matchesCacheKey(cacheKey, matcher)),
    )

    if (matchingCollections.length === 0) {
      logProvider.log.warn({ cacheKey }, 'No collections match cache key identity for seeding')
      return
    }

    // Use cacheKey.key directly — callers guarantee the key is already acquired in storage.
    // Do NOT call cacheManager.acquire/acquireKey here to avoid re-entrant event emission.
    const ctx = await this.buildFetchContext()

    for (const collection of matchingCollections) {
      const topics = collection.seedOnDemand.subscribeTopics(cacheKey)
      await this.seedOneCollection({ collection, cacheKey, topics, ctx })
    }

    // Emit aggregate settlement event for this cache key
    const collectionResults = matchingCollections.map((c) => {
      const s = this.seedStatus.get(c.name, cacheKey.key)
      return { name: c.name, seeded: s?.seeded ?? false, error: s?.error }
    })
    const allSucceeded = collectionResults.every((r) => r.seeded)

    this.eventBus.emit('cache:seed-settled', {
      cacheKey,
      status: allSucceeded ? 'succeeded' : 'failed',
      collections: collectionResults,
    })
  }

  /**
   * Signal that the user has been authenticated.
   * Delegates to SessionManager and returns whether the session was resumed.
   *
   * When the userId differs from the cached session, the data wipe is awaited
   * inline before SessionManager creates the new session.  This prevents the
   * fire-and-forget event subscription from racing with the new session's sync.
   */
  public async setAuthenticated(params: { userId: string }): Promise<{ resumed: boolean }> {
    const previousUserId = this.sessionManager.getUserId()
    const isUserChange = previousUserId !== undefined && previousUserId !== params.userId

    if (isUserChange) {
      this.sessionDestroyHandledInline = true
      try {
        await this.writeQueue.resetSession('user-changed')
        // signalAuthenticated must run inside the flag scope: it calls
        // wipeAndCreateSession which emits session:destroyed synchronously.
        // If the flag were already cleared, the destroyedSub subscription
        // would fire a redundant writeQueue.resetSession that races with
        // the new session's startSync — wiping seed statuses mid-seed.
        return await this.sessionManager.signalAuthenticated(params.userId)
      } finally {
        this.sessionDestroyHandledInline = false
      }
    }

    return this.sessionManager.signalAuthenticated(params.userId)
  }

  /**
   * Signal that the user has logged out.
   * Delegates to SessionManager after awaiting the data wipe.
   */
  public async setUnauthenticated(): Promise<void> {
    const hasSession = this.sessionManager.getUserId() !== undefined

    if (hasSession) {
      this.sessionDestroyHandledInline = true
      try {
        await this.writeQueue.resetSession('explicit')
        // Same as setAuthenticated: signalLoggedOut emits session:destroyed,
        // which must be suppressed to prevent a redundant reset.
        await this.sessionManager.signalLoggedOut()
        return
      } finally {
        this.sessionDestroyHandledInline = false
      }
    }

    await this.sessionManager.signalLoggedOut()
  }

  /**
   * Handle coming online.
   */
  private onOnline(): void {
    logProvider.log.debug('Connectivity online, starting sync')
    if (!this.sessionManager.isNetworkPaused()) {
      this.startSync().catch((err) => {
        logProvider.log.error({ err }, 'startSync failed (onOnline)')
      })
    }
  }

  /**
   * Handle going offline.
   */
  private onOffline(): void {
    logProvider.log.debug('Connectivity offline, pausing')
    // Pause command processing. pause() is contractually non-throwing, but the
    // subscription callback is void so the returned promise must be caught.
    this.commandQueue.pause().catch((err) => {
      logProvider.log.error({ err }, 'Command queue pause failed (onOffline)')
    })
    // Disconnect WebSocket
    this.disconnectWebSocket()
  }

  /**
   * Handle session destroyed (logout).
   * Cleans up sync state while keeping connectivity monitoring alive
   * so we're ready when a new session starts.
   */
  protected async onSessionDestroyed(): Promise<void> {
    logProvider.log.debug('Session destroyed, cleaning up sync state')

    // 1. Disconnect WebSocket
    this.disconnectWebSocket()

    // 2. Abort in-flight fetches and create a fresh AbortController for the next session
    this.abortController?.abort()
    this.abortController = new AbortController()

    // 4. Clear revision tracking and topic subscriptions
    this.knownRevisions.clear()
    this.gapRepair.reset()
    this.topicsByCacheKey.clear()

    // 5. Cancel pending invalidation refetches
    this.invalidationScheduler.cancelAll()

    // 6. Clear all commands — pauses, clears retry timers, waits for in-flight, deletes commands
    await this.commandQueue.clearAll()

    // 7. Cascade-delete all cache keys, events, and read models from storage + clear in-memory state
    await this.cacheManager.onSessionDestroyed()

    // 8. Clear gap buffer and cacheKeyStreams index
    this.eventCache.clearGapBuffer()

    // 9. Clear query manager holds (without calling cacheManager — already wiped)
    this.queryManager.onSessionDestroyed()

    // 10. Reset all seed statuses — clear on-demand entries, reinitialize seedOnInit entries
    this.seedStatus.clear()
    for (const collection of this.collections) {
      if (collection.seedOnInit?.cacheKey) {
        this.seedStatus.set(collection.name, collection.seedOnInit.cacheKey.key, {
          collection: collection.name,
          cacheKey: collection.seedOnInit.cacheKey.key,
          seeded: false,
          syncing: false,
        })
      }
    }

    // 11. Invalidate active queries so connected windows re-fetch (now-empty) data.
    //     In shared-worker mode the worker survives page reloads, so windows that
    //     mounted before setAuthenticated may still be showing stale read models.
    for (const collection of this.collections) {
      this.eventBus.emit('readmodel:updated', {
        collection: collection.name,
        ids: [],
        commandIds: [],
      })
    }
  }

  /**
   * Start full sync process.
   * Single-flight: concurrent callers share the in-progress promise.
   */
  private async startSync(): Promise<void> {
    if (this.startSyncPromise) return this.startSyncPromise
    this.startSyncPromise = this.doStartSync()
    try {
      await this.startSyncPromise
    } finally {
      this.startSyncPromise = undefined
    }
  }

  private async doStartSync(): Promise<void> {
    logProvider.log.debug('Starting sync')

    // Restore revision tracking from persisted read models (prevents false gap detection after reload)
    await this.gapRepair.restoreKnownRevisions()

    // Resume command processing and drain pending commands
    const resumeCommands = this.commandQueue.resume()

    // Seed collections configured with seedOnInit
    await this.startSeedOnInit()
    // TODO: resume seedOnDemand collections from persisted cache keys (spec §4.8)
    // On restart, consult stored cache keys in the DB to determine what to
    // re-seed and in what order (held > recent > frozen).

    // Connect WebSocket for real-time updates
    this.connectWebSocket()

    await resumeCommands
  }

  private async startSeedOnInit(): Promise<void> {
    const ctx = await this.buildFetchContext()
    for (const collection of this.collections) {
      if (!collection.seedOnInit) continue
      const canSeed = collection.fetchSeedRecords || collection.fetchSeedEvents
      if (!canSeed) continue
      const status = this.seedStatus.get(collection.name, collection.seedOnInit.cacheKey.key)
      if (status && !status.seeded) {
        // Acquire the key first (creates in storage + emits events).
        // The cache:key-added event may trigger onCacheKeyAdded → seedForKey,
        // but seedOneCollection sets syncing: true before fetching, so the
        // event-driven path is caught by idempotency.
        await this.cacheManager.acquireKey(collection.seedOnInit.cacheKey)
        await this.seedOneCollection({
          collection,
          cacheKey: collection.seedOnInit.cacheKey,
          topics: collection.seedOnInit.topics,
          ctx,
        })
      }
    }
  }

  // todo: do we need a resume session startSeedOnDemand function?

  /**
   * Seed one collection for one cache key.
   * Shared core logic used by both seedOnInit and seedOnDemand paths.
   * Handles seed status, idempotency, fetching, topic subscription, and event emission.
   * Does NOT handle collection matching or settlement.
   *
   * @param params.collection - Collection to seed
   * @param params.cacheKey - Cache key identity to seed under
   * @param params.topics - Pre-resolved WS topic patterns to subscribe to for this key
   * @param params.ctx - Fetch context with base URL, headers, and abort signal
   * @returns `{ seeded: true, recordCount }` if data was seeded, `{ seeded: false, recordCount: 0 }` if skipped or failed
   */
  protected async seedOneCollection(params: {
    collection: Collection<TLink>
    cacheKey: CacheKeyIdentity<TLink>
    topics: readonly string[]
    ctx: FetchContext
  }): Promise<Result<{ seeded: boolean; recordCount: number }, WriteQueueException>> {
    const { collection, cacheKey, topics, ctx } = params
    // Ensure status entry exists
    if (!this.seedStatus.has(collection.name, cacheKey.key)) {
      this.seedStatus.set(collection.name, cacheKey.key, {
        collection: collection.name,
        cacheKey: cacheKey.key,
        seeded: false,
        syncing: false,
      })
    }

    // Idempotency: skip if already seeded or currently syncing
    const status = this.seedStatus.get(collection.name, cacheKey.key)
    if (status?.seeded || status?.syncing) return Ok({ seeded: false, recordCount: 0 })

    const pageSize = collection.seedPageSize ?? 100

    this.seedStatus.update(collection.name, cacheKey.key, { syncing: true, error: undefined })
    this.eventBus.emit('sync:started', { collection: collection.name })

    try {
      let recordCount = 0
      if (collection.fetchSeedRecords) {
        const res = await this.seedWithRecords({
          collection,
          ctx,
          cacheKey,
          pageSize,
          source: 'seed',
        })
        if (!res.ok) return res
        recordCount = res.value
      } else if (collection.fetchSeedEvents) {
        const res = await this.seedWithEvents(collection, ctx, cacheKey, pageSize)
        if (!res.ok) return res
        recordCount = res.value
      }

      this.seedStatus.update(collection.name, cacheKey.key, { seeded: true, syncing: false })

      // Subscribe to WS topics for this cache key
      if (topics.length > 0) {
        const topicSet = new Set(topics)
        const existing = this.topicsByCacheKey.get(cacheKey.key)
        if (existing) {
          for (const t of topicSet) existing.add(t)
        } else {
          this.topicsByCacheKey.set(cacheKey.key, topicSet)
        }
        if (this.wsConnection) {
          this.wsConnection.send(
            serializeClientMessage({ type: 'subscribe', topics: [...topicSet] }),
          )
        }
      }

      this.eventBus.emit('sync:completed', { collection: collection.name, eventCount: 0 })
      this.eventBus.emit('sync:seed-completed', {
        collection: collection.name,
        cacheKey,
        recordCount,
      })
      return Ok({ seeded: true, recordCount })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logProvider.log.error(
        { collection: collection.name, cacheKey, topics, err: error },
        'Seed failed',
      )
      this.seedStatus.update(collection.name, cacheKey.key, {
        syncing: false,
        error: errorMessage,
      })
      this.eventBus.emit('sync:failed', {
        collection: collection.name,
        error: errorMessage,
      })
      // should this be an Exception or the current value?
      return Ok({ seeded: false, recordCount: 0 })
    }
  }

  /**
   * Seed a collection using pre-computed read model records.
   *
   * @returns Total number of records seeded
   */
  private async seedWithRecords(params: {
    collection: Collection<TLink>
    ctx: FetchContext
    cacheKey: CacheKeyIdentity<TLink>
    pageSize: number
    source: ApplyRecordsOp<TLink>['source']
  }): Promise<Result<number, WriteQueueException>> {
    const { collection, ctx, cacheKey, pageSize, source } = params
    let cursor: string | null = null
    let totalRecords = 0

    let lastEnqueue: Promise<Result<void, WriteQueueException>> | undefined

    do {
      const page = await collection.fetchSeedRecords!({
        ctx,
        cursor,
        limit: pageSize,
        cacheKey,
      })
      this.connectivity.reportContact()

      if (page.records.length > 0) {
        lastEnqueue = this.writeQueue.enqueue({
          type: 'apply-records',
          collection: collection.name,
          cacheKey,
          records: page.records,
          source,
        })
        totalRecords += page.records.length
      }

      if (page.records.length < pageSize) break
      cursor = page.nextCursor
    } while (cursor)

    // Await the last page's enqueue to ensure all writes complete before emitting events.
    if (lastEnqueue) {
      const res = await lastEnqueue
      if (!res.ok) return res
    }

    // Notify reactive queries that seeding is complete.
    // Unlike seedWithEvents (where each `apply-seed-events` op routes through
    // the reconcile pipeline, which emits `readmodel:updated` per batch from
    // Phase 6), record-based seeding writes directly to storage, so a single
    // bulk notification is needed after all pages are loaded.
    // Always emit, even for zero records — consumers need the signal to
    // resolve loading state for genuinely empty collections.
    this.eventBus.emit('readmodel:updated', {
      collection: collection.name,
      ids: [],
      commandIds: [],
    })

    this.eventBus.emit('sync:seed-completed', {
      collection: collection.name,
      cacheKey,
      recordCount: totalRecords,
    })

    return Ok(totalRecords)
  }

  /**
   * Seed a collection using events processed through event processors.
   *
   * @returns Total number of events seeded
   */
  private async seedWithEvents(
    collection: Collection<TLink>,
    ctx: FetchContext,
    cacheKey: CacheKeyIdentity<TLink>,
    pageSize: number,
  ): Promise<Result<number, WriteQueueException>> {
    let cursor: string | null = null
    let eventCount = 0
    let lastEnqueue: Promise<Result<void, WriteQueueException>> | undefined

    do {
      const page = await collection.fetchSeedEvents!({
        ctx,
        cursor,
        limit: pageSize,
        cacheKey,
      })
      this.connectivity.reportContact()

      if (page.events.length > 0) {
        lastEnqueue = this.writeQueue.enqueue({
          type: 'apply-seed-events',
          collection: collection.name,
          cacheKey,
          events: page.events,
        })
        eventCount += page.events.length
      }

      if (page.events.length < pageSize) break
      cursor = page.nextCursor
    } while (cursor)

    if (lastEnqueue) {
      const res = await lastEnqueue
      if (!res.ok) return res
    }

    logProvider.log.debug({ collection: collection.name, eventCount }, 'Event-based seed completed')

    this.eventBus.emit('sync:seed-completed', {
      collection: collection.name,
      cacheKey,
      recordCount: eventCount,
    })

    return Ok(eventCount)
  }

  /**
   * Handle a new cache key being created.
   * Seeds all collections whose keyTypes match the identity (§4.2.1).
   * Idempotent — SeedStatusIndex prevents re-seeding already-seeded pairs.
   */
  private async onCacheKeyAdded(cacheKey: CacheKeyIdentity<TLink>): Promise<void> {
    const hasMatching = this.collections.some((c) =>
      c.seedOnDemand?.keyTypes.some((matcher) => matchesCacheKey(cacheKey, matcher)),
    )
    if (!hasMatching) return

    await this.seedForKey(cacheKey)
  }

  /**
   * Write queue handler for evict-cache-key.
   */
  // TODO: cancel in-flight seeds on eviction (currently self-healing — eviction cascade
  // deletes records written by in-flight seed, but cancellation would avoid wasted work)
  private async onEvictCacheKey(op: EvictCacheKeyOp): Promise<void> {
    const { cacheKey } = op
    const streamIds = await this.eventCache.clearByCacheKey(cacheKey)
    this.clearKnownRevisions(streamIds)
    this.queryManager.releaseForCacheKey(cacheKey)
    this.seedStatus.deleteAllForCacheKey(cacheKey)
    this.unsubscribeForKey(cacheKey)
  }

  /**
   * Write queue handler for apply-records.
   *
   * Writes a page of seed/refetch records to the read model store, then
   * routes the dirty entities through the shared reconcile block so
   * pending commands whose primary entity appears in the batch get
   * re-evaluated against the new server baseline.
   */
  private async onApplyRecords(op: ApplyRecordsOp<TLink>): Promise<void> {
    if (op.records.length === 0) return

    const collection = this.collections.find((c) => c.name === op.collection)

    const serverStateByKey = new Map<string, object>()
    const clientStateByKey = new Map<string, object>()

    const dirtyEntityKeys = new Set<string>()
    const modifiedByCollection = new Map<string, Set<string>>()
    const cacheKeysByKey = new Map<string, Set<string>>()
    const pendingApplications: DeferredApplication[] = []

    // Stage each record for deferred write + mirror into the working state.
    // Writes happen at end-of-pipeline in `reconcileAndPersist` Phase 6.
    for (const record of op.records) {
      const revisionMeta = record.revision
        ? { revision: record.revision, position: record.position }
        : undefined
      pendingApplications.push({
        result: {
          collection: op.collection,
          id: record.id,
          update: { type: 'set', data: record.data },
          isServerUpdate: true,
        },
        cacheKey: op.cacheKey.key,
        revisionMeta,
      })

      const key = stateKey(op.collection, record.id)
      serverStateByKey.set(key, record.data)
      dirtyEntityKeys.add(key)
      cacheKeysByKey.set(key, new Set([op.cacheKey.key]))

      let ids = modifiedByCollection.get(op.collection)
      if (!ids) {
        ids = new Set()
        modifiedByCollection.set(op.collection, ids)
      }
      ids.add(record.id)

      // Advance knownRevisions from record revision.
      if (record.revision && collection) {
        const streamId = collection.aggregate.getStreamId(record.id)
        const revBigint = BigInt(record.revision)
        const current = this.knownRevisions.get(streamId)
        if (current === undefined || revBigint > current) {
          this.knownRevisions.set(streamId, revBigint)
          this.eventCache.setKnownPosition(streamId, revBigint)
        }
      }
    }

    await this.reconcileAndPersist({
      dirtyEntityKeys,
      serverStateByKey,
      clientStateByKey,
      cacheKeysByKey,
      modifiedByCollection,
      commandIdsByCollection: new Map(),
      idMap: new Map(),
      tempIdsToDelete: new Set(),
      preloadedRecords: new Map(),
      pendingApplications,
    })
  }

  /**
   * Write queue handler for apply-seed-events.
   *
   * Caches the seed events, then routes them through the same reconcile
   * infrastructure the WS and command-response paths use. This ensures
   * pending commands whose primary entity appears in the seed batch get
   * re-evaluated against the new server baseline — previously, seeds
   * wrote to the store without triggering command re-runs.
   *
   * Bypasses the dedup and gap-detection passes in `onReconcileWsEventsOp`
   * (seed events are already cached by this handler, and revision ordering
   * is guaranteed by the server's seed response).
   */
  private async onApplySeedEvents(op: ApplySeedEventsOp<TLink>): Promise<void> {
    const sharedCacheKeys = [op.cacheKey.key]
    await this.eventCache.cacheServerEventsWithKeys(
      op.events.map((event) => ({ event, cacheKeys: sharedCacheKeys })),
    )

    // Build entries compatible with the reconcile pipeline. All events
    // in a seed page share the same single cache key identity.
    const entries: PendingWsEventEntry<TLink>[] = op.events.map((event) => ({
      event,
      cacheKeys: [op.cacheKey],
    }))

    const preloaded = await this.setupWsReconcileBatch(entries)
    await this.reconcileFromWsEvents(entries, preloaded)

    // Advance `knownRevisions` for each Permanent event in the batch.
    // The reconcile pipeline's setup block handles lazy population from
    // stored records, but the drain's post-reconcile bookkeeping (which
    // tracks `advancedStreams` and clears gap buffers) is specific to
    // `onReconcileWsEventsOp`. Seed events need their own advancement
    // because they establish the authoritative baseline for the stream.
    for (const event of op.events) {
      const persistence = normalizeEventPersistence(event)
      if (persistence === 'Permanent') {
        const current = this.knownRevisions.get(event.streamId)
        if (current === undefined || event.revision > current) {
          this.knownRevisions.set(event.streamId, event.revision)
        }
      }
    }

    const processedIds = op.events
      .filter((e) => normalizeEventPersistence(e) !== 'Anticipated')
      .map((e) => e.id)
    if (processedIds.length > 0) {
      await this.eventCache.markProcessed(processedIds)
    }
  }

  /**
   * Build network context for collection fetch methods.
   * Merges static headers from NetworkConfig with dynamic auth headers
   * from the AuthStrategy. For cookie-based auth, this is a no-op —
   * the browser sends cookies automatically with fetch().
   */
  protected async buildFetchContext(): Promise<FetchContext> {
    const headers: Record<string, string> = { ...this.networkConfig.headers }
    const authHeaders = (await this.auth.getHttpHeaders?.()) ?? {}
    Object.assign(headers, authHeaders)
    const signal = this.abortController?.signal ?? AbortSignal.abort()
    return { baseUrl: this.networkConfig.baseUrl, headers, signal }
  }

  /**
   * Find all collections that match a given streamId.
   */
  private getMatchingCollections(streamId: string): Collection<TLink>[] {
    return this.collections.filter((c) => c.matchesStream(streamId))
  }

  /**
   * Resolve cache key identities from WS message topics.
   * Finds matching collections by streamId, then calls each collection's
   * `cacheKeysFromTopics` to derive the cache keys.
   * Templates (without `.key`) are resolved via registerCacheKeySync.
   */
  protected resolveCacheKeysFromTopics(
    streamId: string,
    topics: readonly string[],
  ): CacheKeyIdentity<TLink>[] {
    const matchingCollections = this.getMatchingCollections(streamId)
    const seen = new Set<string>()
    const keys: CacheKeyIdentity<TLink>[] = []
    for (const collection of matchingCollections) {
      for (const keyOrTemplate of collection.cacheKeysFromTopics(topics)) {
        // Templates don't have a .key — resolve them through the registry
        const cacheKey =
          'key' in keyOrTemplate
            ? keyOrTemplate
            : this.cacheManager.registerCacheKeySync(keyOrTemplate)
        if (!seen.has(cacheKey.key)) {
          seen.add(cacheKey.key)
          keys.push(cacheKey)
        }
      }
    }
    return keys
  }

  /**
   * Connect WebSocket for real-time events.
   */
  private connectWebSocket(): void {
    if (!this.networkConfig.wsUrl || this.wsConnection) return

    this.openAuthenticatedWebSocket(this.networkConfig.wsUrl)
      .then((socket) => {
        this.wsConnection = socket

        socket.onmessage = (wsEvent) => {
          try {
            const message = parseServerMessage(wsEvent.data)
            if (!message) return

            switch (message.type) {
              case 'connected':
                logProvider.log.debug('WebSocket server ack')
                this.connectivity.reportWsConnection('connected')
                this.resubscribeAll()
                break
              case 'event': {
                const wsEvent = hydrateSerializedEvent(message.event)
                const wsCacheKeys = this.resolveCacheKeysFromTopics(
                  wsEvent.streamId,
                  message.topics,
                )
                // Batched drain path: synchronously push into the in-memory
                // pending queue and schedule a `reconcile-ws-events` op. The
                // Batched drain path: synchronously push into the in-memory
                // pending queue and schedule a `reconcile-ws-events` op.
                this.handleNewWsEvent(wsEvent, wsCacheKeys)
                break
              }
              case 'heartbeat':
                this.connectivity.reportContact()
                break
              case 'subscribed':
                logProvider.log.debug({ topics: message.topics }, 'Subscription confirmed')
                this.connectivity.reportWsSubscribed(message.topics)
                break
              case 'unsubscribed':
                logProvider.log.debug({ topics: message.topics }, 'Subscription removed')
                break
              case 'subscription_denied':
              case 'subscription_revoked':
                logProvider.log.warn(
                  { type: message.type, topics: message.topics, message: message.message },
                  'Subscription issue',
                )
                break
            }
          } catch (error) {
            logProvider.log.error({ err: error }, 'Failed to process WebSocket message')
          }
        }

        socket.onclose = () => {
          logProvider.log.debug('WebSocket disconnected')
          this.wsConnection = undefined
          this.connectivity.reportWsConnection('disconnected')
          // Reconnect if still online
          if (this.connectivity.isOnline()) {
            setTimeout(() => {
              this.connectWebSocket()
            }, 5000)
          }
        }

        socket.onerror = () => {
          this.connectivity.reportFailure()
        }
      })
      .catch((error) => {
        logProvider.log.error({ err: error }, 'Failed to connect WebSocket')
      })
  }

  /**
   * Open a WebSocket connection and run auth strategy hooks.
   *
   * 1. Calls `auth.prepareWebSocketUrl` to get the final URL
   * 2. Creates `new WebSocket(url)`
   * 3. Waits for `onopen`
   * 4. If `auth.authenticateWebSocket` exists, calls it; on rejection → close socket, throw
   * 5. Returns the connected+authenticated socket
   */
  private async openAuthenticatedWebSocket(rawUrl: string): Promise<WebSocket> {
    const url = (await this.auth.prepareWebSocketUrl?.(rawUrl)) ?? rawUrl
    const socket = new WebSocket(url)
    this.connectivity.reportWsConnection('connecting')

    await new Promise<void>((resolve, reject) => {
      socket.onopen = () => {
        logProvider.log.debug('WebSocket connected')
        this.connectivity.reportContact()
        resolve()
      }
      socket.onerror = () => {
        this.connectivity.reportFailure()
        reject(new Error('WebSocket connection failed'))
      }
    })

    if (this.auth.authenticateWebSocket) {
      try {
        await this.auth.authenticateWebSocket(socket)
      } catch (error) {
        socket.close()
        throw error
      }
    }

    return socket
  }

  /**
   * Unsubscribe from WS topics for an evicted cache key.
   * Only unsubscribes topics not used by other active keys.
   */
  private unsubscribeForKey(cacheKey: string): void {
    const topics = this.topicsByCacheKey.get(cacheKey)
    if (!topics) return
    this.topicsByCacheKey.delete(cacheKey)

    // Collect topics still active under other keys
    const stillActive = new Set<string>()
    for (const otherTopics of this.topicsByCacheKey.values()) {
      for (const t of otherTopics) stillActive.add(t)
    }

    const toUnsubscribe = [...topics].filter((t) => !stillActive.has(t))
    if (toUnsubscribe.length > 0 && this.wsConnection) {
      this.wsConnection.send(serializeClientMessage({ type: 'unsubscribe', topics: toUnsubscribe }))
    }
  }

  /**
   * Re-subscribe all active topics after WS reconnection.
   */
  private resubscribeAll(): void {
    if (!this.wsConnection) return
    const allTopics = new Set<string>()
    for (const topics of this.topicsByCacheKey.values()) {
      for (const t of topics) allTopics.add(t)
    }
    if (allTopics.size === 0) return
    this.wsConnection.send(serializeClientMessage({ type: 'subscribe', topics: [...allTopics] }))
  }

  /**
   * Disconnect WebSocket.
   * Nulls out handlers before calling close() to prevent the onclose handler
   * from scheduling a reconnect timer on intentional disconnection.
   */
  private disconnectWebSocket(): void {
    if (this.wsConnection) {
      this.wsConnection.onclose = null
      this.wsConnection.onerror = null
      this.wsConnection.onmessage = null
      this.wsConnection.close()
      this.wsConnection = undefined
      this.connectivity.reportWsConnection('disconnected')
    }
  }

  /**
   * Network boundary: WebSocket event arrival.
   *
   * Synchronous capture + deferred process. Called for every incoming WS event
   * (once the WS message has been parsed and cache keys resolved). Pushes the
   * event into the in-memory `pendingWsEvents` queue and schedules a single
   * `reconcile-ws-events` op via the WriteQueue — subsequent events arriving
   * before the op runs accumulate into the same batch without re-enqueueing.
   *
   * No async work is done here: everything the drain needs must be present
   * on `event` and `cacheKeys` at call time.
   */
  protected handleNewWsEvent(event: IPersistedEvent, cacheKeys: CacheKeyIdentity<TLink>[]): void {
    // Snapshot by reference — cache keys are immutable value types and the
    // event was constructed upstream; both are safe to hold without cloning.
    this.pendingWsEvents.push({ event, cacheKeys })
    this.eventBus.emitDebug('sync:ws-event-received', { event })
    this.scheduleWsReconcile()
  }

  /**
   * Network boundary: events arriving via a command response envelope.
   *
   * Fire-and-forget: pushes each event into the same `pendingWsEvents`
   * queue the WS path uses and schedules the `reconcile-ws-events` op.
   * Does NOT return a promise tied to event processing — command
   * lifecycle resolution is driven by `response.id` and
   * `response.nextExpectedRevision` in `CommandQueue`, not by whether
   * these events have been applied.
   *
   * Drop rule: if the command's cacheKey is no longer registered in
   * `CacheManager` (UI released it between send and response), drop
   * the batch entirely. The WS path has an implicit version of this
   * drop because topic subscriptions are managed per held cacheKey —
   * the response path needs an explicit check because the command's
   * cacheKey was captured at enqueue time, not at response time.
   *
   * Gap detection inside the drain handles the "events ahead of
   * `knownRevisions`" case (e.g. the response is the first thing the
   * client sees for this stream after a session restart) — the gap
   * pass kicks repair, which eventually fills the missing revisions.
   */
  handleCommandResponseEvents(
    events: readonly IPersistedEvent[],
    cacheKey: CacheKeyIdentity<TLink>,
  ): void {
    if (events.length === 0) return
    if (!this.cacheManager.existsSync(cacheKey.key)) return

    for (const event of events) {
      this.pendingWsEvents.push({ event, cacheKeys: [cacheKey] })
      this.eventBus.emitDebug('sync:ws-event-received', { event })
    }
    this.scheduleWsReconcile()
  }

  /**
   * Enqueue a `reconcile-ws-events` op if one isn't already queued.
   *
   * Mirrors CacheManager's `scheduleDirtyFlush`: the `wsReconcilePending` flag
   * guards against double-enqueue of the same pending op. The flag is cleared
   * as the FIRST action inside the op handler, so any events captured while
   * the drain is in-flight will enqueue a fresh op for the next batch and
   * will not race with the current drain's snapshot step.
   */
  private scheduleWsReconcile(): void {
    if (this.wsReconcilePending) return
    if (this.pendingWsEvents.length === 0) return

    this.wsReconcilePending = true
    const op: ReconcileWsEventsOp = { type: 'reconcile-ws-events' }
    // Fire and forget — the eviction handler registered in the constructor
    // resets `wsReconcilePending` if the op is discarded before it runs, and
    // the drain handler clears the flag as its first action. `.catch()` is
    // the wrong mechanism for this: it doesn't cover all eviction paths and
    // the WriteQueue already owns the discard → eviction-handler contract.
    void this.writeQueue.enqueue(op)
  }

  /**
   * Setup helper for the batched WS reconcile op.
   *
   * Bulk-loads the read model records for every unique event target in
   * the post-dedup batch and lazily populates `knownRevisions` for any
   * stream whose baseline revision is not yet in memory. Returns the
   * loaded record map so the reconcile function can reuse it in Phase 2
   * without re-reading the store.
   *
   * This runs BEFORE gap detection. Gap detection reads `knownRevisions`
   * per stream to decide happy-path vs has-gap; without prior population
   * the first event for a stream after session restart would trip
   * `has-gap` even when the persisted read model already reflects that
   * stream's latest revision.
   *
   * Side-effect contract: populates `knownRevisions` for unset streams.
   * MUST NOT trigger gap repair, invalidation, or read-model writes —
   * those belong to the handle-updates block.
   */
  private async setupWsReconcileBatch(
    entries: readonly PendingWsEventEntry<TLink>[],
  ): Promise<Map<string, ReadModel>> {
    // Unique per (collection, entityId) for the bulk read. Tracked with
    // streamId so the knownRevisions population below can look up each
    // loaded record by the same state key without re-running
    // `matchesStream`.
    const targets = new Map<string, { collection: string; id: string; streamId: string }>()
    for (const entry of entries) {
      const primaryCollection = this.collections.find((c) => c.matchesStream(entry.event.streamId))
      if (!primaryCollection) continue
      const id = (entry.event.data as { id?: unknown }).id
      if (typeof id !== 'string') continue
      const key = stateKey(primaryCollection.name, id)
      if (targets.has(key)) continue
      targets.set(key, {
        collection: primaryCollection.name,
        id,
        streamId: entry.event.streamId,
      })
    }
    if (targets.size === 0) return new Map()

    const loaded = await this.readModelStore.getManyByCollectionIds(
      Array.from(targets.values(), ({ collection, id }) => ({ collection, id })),
    )

    // Populate `knownRevisions` lazily for any stream whose baseline
    // isn't yet in memory but is persisted on the corresponding read
    // model row. Conditional on `record.revision` — locally-created
    // entries have no server revision to seed from.
    for (const [key, { streamId }] of targets) {
      if (this.knownRevisions.has(streamId)) continue
      const record = loaded.get(key)
      if (!record?.revision) continue
      this.knownRevisions.set(streamId, BigInt(record.revision))
    }

    return loaded
  }

  /**
   * Drain handler for `reconcile-ws-events`.
   *
   * Runs inside the WriteQueue's serialized processing loop. Snapshots the
   * pending events into a local batch and clears the in-memory queue so new
   * events can accumulate into the next batch independently.
   *
   * Split into two blocks with distinct responsibilities:
   *
   *   SETUP — dedup against EventCache, then bulk-load read model records
   *   for every event target in the filtered batch and lazily populate
   *   `knownRevisions` for any stream whose baseline revision is not yet
   *   in memory. Must run before gap detection so the gap check reads a
   *   correct baseline. Gap repair MUST NOT fire from this block.
   *
   *   HANDLE UPDATES — gap detection (may schedule gap repair or
   *   invalidation), reconcile (applies server events, re-runs dirtied
   *   commands, persists read model mutations), post-reconcile
   *   bookkeeping (seed status positions, markProcessed, debug emits).
   *   All side effects that react to the batch's contents live here.
   */
  protected async onReconcileWsEventsOp(_op: ReconcileWsEventsOp): Promise<void> {
    // Clear the flag FIRST so any new events captured during the async drain
    // schedule a fresh op for the next batch instead of being absorbed into
    // this in-flight one. See the `scheduleWsReconcile` doc for the rationale.
    this.wsReconcilePending = false

    if (this.pendingWsEvents.length === 0) return

    // Reference-swap the pending queue: capture the current array and install
    // a fresh empty one in a single synchronous step. Subsequent
    // `handleNewWsEvent` calls push into the new array; the in-flight drain
    // operates on the captured one. No splice, no array churn.
    const batch = this.pendingWsEvents
    this.pendingWsEvents = []

    // ========================================================================
    // SETUP BLOCK
    // ========================================================================

    // --- Dedup pass (setup) ---
    // One bulk existence query for the whole batch splits entries into
    // "new" (cache + include in reconcile batch) and "already-seen"
    // (add cache-key associations and drop from reconcile batch). The
    // bulk check replaces the per-entry `getCachedEvent` round-trip
    // baked into the old single-event `cacheServerEvent` path.
    //
    // New events are cached in a single `cacheServerEventsWithKeys`
    // round-trip regardless of whether the entries share cacheKey sets.
    //
    // Events with no active cache keys are dropped outright — they
    // can't belong to any subscriber and have no routing target.
    const routed: PendingWsEventEntry<TLink>[] = []
    for (const entry of batch) {
      if (entry.cacheKeys.length === 0) continue
      routed.push(entry)
    }
    if (routed.length === 0) return

    const existingIds = await this.eventCache.getExistingEventIds(
      routed.map((entry) => entry.event.id),
    )

    const filtered: PendingWsEventEntry<TLink>[] = []
    const newEntries: CacheServerEventEntry[] = []
    const existingEntries: CacheServerEventEntry[] = []
    for (const entry of routed) {
      const activeCacheKeys = entry.cacheKeys.map((ck) => ck.key)
      if (existingIds.has(entry.event.id)) {
        // Already cached — add the new cache-key associations so subscribers
        // on those keys see the event too, then drop it from the reconcile
        // batch. Collected here and flushed in one storage call below.
        existingEntries.push({ event: entry.event, cacheKeys: activeCacheKeys })
        continue
      }
      newEntries.push({ event: entry.event, cacheKeys: activeCacheKeys })
      filtered.push(entry)
    }

    await this.eventCache.addCacheKeysToEvents(existingEntries)
    await this.eventCache.cacheServerEventsWithKeys(newEntries)

    if (filtered.length === 0) return

    // --- Lazy knownRevisions population (setup) ---
    // Bulk-load the read model records for every unique event target in
    // the filtered batch and seed `knownRevisions` for any stream whose
    // baseline revision is not already in memory. Fixes the first-event-
    // after-session-restart case where the persisted read model has a
    // baseline but the in-memory map starts empty (the map is not
    // persistent). The loaded record map is handed to the reconcile so
    // Phase 2 doesn't reload these targets. Gap repair MUST NOT fire
    // from this block — gap detection runs below in the handle-updates
    // block, where decisions about repair live.
    const preloadedRecords = await this.setupWsReconcileBatch(filtered)

    // ========================================================================
    // HANDLE UPDATES BLOCK
    // ========================================================================

    // --- Gap detection pass (handle updates) ---
    //
    // For each Permanent event, verify its revision is consecutive with the
    // known revision for its stream. Events in order advance `knownRevisions`
    // inline so subsequent events in the same stream within the batch see
    // the new baseline when `gapRepair.checkAndRepairGap` is called.
    //
    // Events are grouped by stream and sorted by revision ascending before
    // the walk. The walk keeps every pre-gap event and stops at the first
    // gap / invalidation, so pre-gap events in the same stream are still
    // processed locally — they passed the check cleanly and advanced the
    // stream. Only events AT and AFTER the gap are dropped from the batch.
    //
    // Outcomes per event:
    //   - `'no-gap'`: keep in the filtered-for-reconcile batch, advance
    //     `knownRevisions[streamId]` to this revision, and record the
    //     advance so the post-reconcile pass can clear the gap buffer
    //     and set the known position for the stream.
    //   - `'has-gap'`: stop walking this stream's sorted bucket. The
    //     out-of-order event is already in EventCache (from the dedup
    //     pass) and will be processed by `processBufferedEventsForStream`
    //     after `gapRepair.repairStreamGap` fetches the missing revisions.
    //     Any events in this batch with higher revisions on the same
    //     stream are dropped from the current reconcile batch for the
    //     same reason — they can't be processed until the gap fills —
    //     but they stay cached and will be drained by the repair op.
    //     Pre-gap events already added to `gapFiltered` are untouched.
    //   - `'invalidated'`: schedule a refetch for every matching collection
    //     under the event's cache keys, then stop walking this stream's
    //     sorted bucket. Events from this stream at or after the gap are
    //     dropped from the batch; the refetch will replace the entire
    //     collection's state when it lands. Pre-gap events in the same
    //     stream stay in `gapFiltered` — their local state changes are
    //     harmless and will be superseded by the refetch anyway.
    //
    // Stateful events bypass the gap check entirely — their ordering doesn't
    // matter per spec §4.7. They passthrough into the reconcile batch.
    const streamBuckets = new Map<string, PendingWsEventEntry<TLink>[]>()
    const statefulPassthrough: PendingWsEventEntry<TLink>[] = []
    for (const entry of filtered) {
      const persistence = normalizeEventPersistence(entry.event)
      if (persistence === 'Stateful') {
        statefulPassthrough.push(entry)
        continue
      }
      let bucket = streamBuckets.get(entry.event.streamId)
      if (!bucket) {
        bucket = []
        streamBuckets.set(entry.event.streamId, bucket)
      }
      bucket.push(entry)
    }

    const gapFiltered: PendingWsEventEntry<TLink>[] = [...statefulPassthrough]
    // Streams whose `knownRevisions` we advanced during this pass. Used by
    // the post-reconcile bookkeeping below to clear per-stream gap buffers
    // and advance known positions in EventCache.
    const advancedStreams = new Map<string, bigint>()

    for (const [streamId, streamEvents] of streamBuckets) {
      streamEvents.sort((a, b) => {
        if (a.event.revision === b.event.revision) return 0
        return a.event.revision < b.event.revision ? -1 : 1
      })

      for (const entry of streamEvents) {
        const { event } = entry
        const matchingCollections = this.collections.filter((c) => c.matchesStream(event.streamId))
        const [primaryCollection] = matchingCollections
        if (!primaryCollection) continue // no routing target — drop

        const gapStatus = this.gapRepair.checkAndRepairGap(
          event,
          primaryCollection.name,
          entry.cacheKeys,
        )

        if (gapStatus === 'invalidated') {
          // Gap unrecoverable — schedule an async refetch for every
          // matching collection under the active cache keys and stop
          // processing this stream's events in the batch. The remaining
          // events in this stream's bucket are dropped; they'll be
          // re-delivered (or not) after the refetch reseeds the collection.
          const activeCacheKeys = entry.cacheKeys.map((ck) => ck.key)
          for (const collection of matchingCollections) {
            this.invalidationScheduler.schedule(collection.name, activeCacheKeys)
          }
          break
        }

        if (gapStatus === 'has-gap') {
          // Gap repair is already in flight (triggered inside
          // `checkAndRepairGap`). Stop processing this stream in this
          // batch — the out-of-order event is buffered and will be
          // delivered by the repair op.
          break
        }

        // 'no-gap': keep the event, advance known revision inline so the
        // next iteration of the same stream sees the new baseline.
        this.knownRevisions.set(streamId, event.revision)
        advancedStreams.set(streamId, event.revision)
        gapFiltered.push(entry)
      }
    }

    if (gapFiltered.length === 0) return

    // --- Reconcile (handle updates) ---
    // TODO(drain-errors): this call is currently unprotected. Wrapping it
    //   in try/catch for error recovery requires a careful control-flow audit
    //   of what errors can surface from `reconcileFromWsEvents` and how each
    //   should be handled. Naive wrapping risks infinite loops — e.g. an
    //   error during invalidation scheduling that re-triggers the same drain.
    //   Defer until we audit the failure modes and pick a recovery strategy
    //   per error class.
    const perEventResults = await this.reconcileFromWsEvents(gapFiltered, preloadedRecords)

    // --- Post-reconcile bookkeeping (handle updates) ---
    //
    // Run once per successfully-processed event. "Successfully processed"
    // now means "passed both the dedup pass and the gap detection pass and
    // made it into the reconcile batch." The reconcile core does not have
    // a partial-failure mode, so if it returned without throwing, every
    // entry in `gapFiltered` is considered processed.
    //
    // Work done per batch:
    //   1. Clear the gap buffer + advance known position for each Permanent
    //      stream we actually advanced during the gap check. (Stateful
    //      events don't participate — they don't advance stream state.)
    //   2. Build per-(collection, cacheKey) max-position updates and call
    //      `seedStatus.update` once per affected tuple.
    //   3. `eventCache.markProcessed([eventIds])` — already batch-native.
    //   4. Emit `sync:ws-event-processed` once per event. Per-event is fine
    //      for the debug bus; consumers subscribe per-event.
    //
    // Stateful event handling is not yet forked here — the reconcile core
    // currently only runs `'Permanent'` processors, so stateful events fall
    // through without processors firing. A later slice will branch stateful
    // events to their own processor lookup. Until then we still mark them
    // processed so they're not re-delivered indefinitely.
    const eventIdsToMarkProcessed: string[] = []
    // Per (collection, cacheKey) → highest position seen in this batch.
    const seedStatusUpdates = new Map<
      string,
      { collection: Collection<TLink>; cacheKey: string; position: bigint }
    >()

    for (const entry of gapFiltered) {
      const { event } = entry
      const persistence = normalizeEventPersistence(event)

      // Seed status: record the highest position per (collection, cacheKey)
      // across the batch. We tag with every matching collection and every
      // active cache key the event arrived under.
      //
      // Stateful events skip seed status updates entirely — their
      // `event.position` is currently a lie (outstanding ddd-es issue
      // for stateful streams) and `lastSyncedPosition` would corrupt the
      // in-memory index if we trusted it. Stateful snapshots don't
      // advance the sync cursor anyway; that's Permanent's job.
      if (persistence !== 'Stateful') {
        const matchingCollections = this.collections.filter((c) => c.matchesStream(event.streamId))
        for (const collection of matchingCollections) {
          for (const ck of entry.cacheKeys) {
            const bucketKey = `${collection.name}::${ck.key}`
            const current = seedStatusUpdates.get(bucketKey)
            if (current === undefined || event.position > current.position) {
              seedStatusUpdates.set(bucketKey, {
                collection,
                cacheKey: ck.key,
                position: event.position,
              })
            }
          }
        }
      }

      eventIdsToMarkProcessed.push(event.id)
      const debug = perEventResults.get(event.id)
      this.eventBus.emitDebug('sync:ws-event-processed', {
        event,
        updatedIds: debug?.updatedIds ?? [],
        invalidated: debug?.invalidated ?? false,
      })
    }

    // Clear per-stream gap state for every stream we advanced. `knownRevisions`
    // itself was advanced inline during the gap check pass.
    for (const [streamId, revision] of advancedStreams) {
      this.eventCache.clearGapBuffer(streamId, revision)
      this.eventCache.setKnownPosition(streamId, revision)
    }

    // Push seed status updates. Each call only touches in-memory state, but
    // they're grouped so we only hit each (collection, cacheKey) tuple once.
    for (const { collection, cacheKey, position } of seedStatusUpdates.values()) {
      if (this.seedStatus.has(collection.name, cacheKey)) {
        this.seedStatus.update(collection.name, cacheKey, { lastSyncedPosition: position })
      }
    }

    if (eventIdsToMarkProcessed.length > 0) {
      await this.eventCache.markProcessed(eventIdsToMarkProcessed)
    }
  }

  /**
   * Reconcile pending commands and local state against a batch of incoming
   * server WebSocket events.
   *
   * This is the canonical entry point for the "server read model source of
   * truth changed" workflow. The pipeline contract is "all reads up front,
   * all writes at the end" — every storage write the batch produces is
   * flushed through the single `readModelStore.commit(mutations)` call near
   * the end of {@link reconcileAndPersist}. Phases:
   *
   *   1. Initial scan — determine which (collection, entityId) pairs the batch
   *      touches; load pending commands + the relevant read models into memory.
   *   2. Run processors against the in-memory working state (no storage
   *      writes). Each processor result is staged into `pendingApplications`
   *      for deferred persistence; `serverStateByKey` mirrors the post-event
   *      baseline so Phase 5 can hand handlers fresh input.
   *   3. Detect `tempId → serverId` resolutions via `event.metadata.commandId`.
   *      Build `idMap` and record the old `collection:tempId` keys for
   *      in-place row rename at persist time.
   *   4. Rewrite pending command data by walking each command's declared
   *      `commandIdReferences` against `idMap`; mark each rewritten command's
   *      primary entity key dirty so the downstream reconcile loop re-executes
   *      it. Does **not** call handlers — that's
   *      {@link reconcilePendingCommands}'s job.
   *   5. Hand off all preloaded state (commands, read models, dirty set,
   *      anticipated events) to {@link reconcilePendingCommands} for the
   *      forward-walk re-execution + anticipated-event regeneration.
   *   6. Persist everything in one batch — rewritten commands, new anticipated
   *      events, command-id mappings, and the full read-model mutation list
   *      (id migrations, deferred server-event writes from Phase 3, Phase 5
   *      client overlays, `_clientMetadata` stamps) via
   *      {@link ReadModelStore.commit}.
   *
   * No interleaved store writes anywhere in phases 1-5.
   */
  private async reconcileFromWsEvents(
    batch: readonly PendingWsEventEntry<TLink>[],
    preloadedRecords: ReadonlyMap<string, ReadModel>,
  ): Promise<Map<string, { updatedIds: string[]; invalidated: boolean }>> {
    const perEventResults = new Map<string, { updatedIds: string[]; invalidated: boolean }>()
    if (batch.length === 0) return perEventResults

    // --- Phase 1: initial scan ---
    // Determine which collections + entities each event touches. System
    // invariant: every server event has `data.id` as its aggregate id (string).
    // Events whose stream doesn't match any configured collection are skipped.
    // We also capture all matching collections and cache keys for each entry
    // so later invalidation scheduling has everything it needs without recompute.
    interface ScannedEvent {
      event: IPersistedEvent
      primaryCollection: Collection<TLink>
      matchingCollections: Collection<TLink>[]
      cacheKeys: readonly CacheKeyIdentity<TLink>[]
      serverId: string
    }
    const scanned: ScannedEvent[] = []
    for (const entry of batch) {
      const matchingCollections = this.collections.filter((c) =>
        c.matchesStream(entry.event.streamId),
      )
      const [primaryCollection] = matchingCollections
      if (!primaryCollection) continue
      const serverId = (entry.event.data as { id: string }).id
      scanned.push({
        event: entry.event,
        primaryCollection,
        matchingCollections,
        cacheKeys: entry.cacheKeys,
        serverId,
      })
    }
    if (scanned.length === 0) return perEventResults

    // --- Phase 2: initialize working state from preloaded records ---
    //
    // Populate two parallel working-state maps from the preloaded records:
    //   - `serverStateByKey`: server baseline, mutated by Phase 3 writes
    //   - `clientStateByKey`: client overlay projection, mutated by Phase 5
    //
    // Command loading and additional-entity loading (for pending commands'
    // primary entities) now lives in `reconcileAndPersist` — it's shared
    // across all entry points, not event-specific.
    const serverStateByKey = new Map<string, object>()
    const clientStateByKey = new Map<string, object>()
    for (const [key, record] of preloadedRecords) {
      if (record.serverData && typeof record.serverData === 'object') {
        serverStateByKey.set(key, record.serverData as object)
      }
      if (record.data && typeof record.data === 'object') {
        clientStateByKey.set(key, record.data as object)
      }
    }

    const modifiedByCollection = new Map<string, Set<string>>()
    const recordModified = (collection: string, id: string): void => {
      let ids = modifiedByCollection.get(collection)
      if (!ids) {
        ids = new Set()
        modifiedByCollection.set(collection, ids)
      }
      ids.add(id)
    }

    const commandIdsByCollection = new Map<string, Set<string>>()
    const recordCommandId = (collection: string, commandId: string): void => {
      let ids = commandIdsByCollection.get(collection)
      if (!ids) {
        ids = new Set()
        commandIdsByCollection.set(collection, ids)
      }
      ids.add(commandId)
    }

    const cacheKeysByKey = new Map<string, Set<string>>()
    const recordCacheKey = (key: string, cacheKey: string): void => {
      let set = cacheKeysByKey.get(key)
      if (!set) {
        set = new Set<string>()
        cacheKeysByKey.set(key, set)
      }
      set.add(cacheKey)
    }

    // Index pending temporary-id create commands by their commandId so
    // Phase 3 can correlate incoming server events back to the originating
    // create. Built from a lightweight command scan — only needs
    // commandId + tempId + creates config, no read model loading.
    interface PendingCreateResolution {
      tempId: string
      createCommand: CommandRecord<TLink, TCommand>
    }
    const pendingCreatesByCommandId = new Map<string, PendingCreateResolution>()
    if (this.domainExecutor) {
      // `'succeeded'` is in scope so just-succeeded temp-id creates still get
      // their Phase 3 tempId → serverId migration when the drain processes
      // response events for them. See `_active-plans/command-applied.md` §2.4.
      const commands = await this.commandStore.getByStatus([
        'pending',
        'blocked',
        'sending',
        'succeeded',
      ])
      for (const command of commands) {
        if (!command.creates || command.creates.idStrategy !== 'temporary') continue
        const entityId = this.commandQueue.getEntityIdForCommand(command)
        if (!entityId) continue
        pendingCreatesByCommandId.set(command.commandId, {
          tempId: entityId,
          createCommand: command,
        })
      }
    }

    // --- Phase 3: apply server events and detect id resolutions ---
    //
    // If a processor signals invalidation for an entity, we:
    //   1. Schedule an async refetch (via invalidationScheduler) for every
    //      collection matching the event's stream, using its active cache keys.
    //   2. Lock the entity's working-state key for the rest of this batch so
    //      subsequent server events targeting the same entity are skipped.
    //
    // A locked entity's working state is left as-is — either unchanged (if the
    // first event against it invalidated before making any changes) or partially
    // updated (if earlier events in the batch modified it before a later event
    // invalidated). Either way, the reconcile loop still re-applies commands
    // against it: commands against older server data are always valid in this
    // system, we just stop accepting *newer* server events for that entity in
    // this loop. Fresh server data arrives via the scheduled refetch.
    // tempId → { serverId, ref, revision }. The `ref` is the original
    // EntityRef that held the tempId before the server event resolved it.
    // Phase 6 uses `ref.commandId` to derive the `commandType` stored in
    // `CommandIdMappingRecord.data`, and `revision` as the aggregate's
    // latest confirmed revision at the moment of resolution.
    const idMap = new Map<string, IdResolution<TLink>>()
    const tempIdsToDelete = new Set<string>()
    const dirtyEntityKeys = new Set<string>()
    const lockedEntityKeys = new Set<string>()
    // Processor results staged for deferred persistence in Phase 6.
    const pendingApplications: DeferredApplication[] = []

    for (const { event, primaryCollection, matchingCollections, cacheKeys, serverId } of scanned) {
      // Per-event debug bookkeeping. `updatedIds` accumulates
      // `${collection}:${id}` for every processor result produced against
      // this event (regardless of whether the write actually changed the
      // row); `invalidated` is the OR across all processors. Events with
      // no matching processors get an empty record.
      const eventDebug: { updatedIds: string[]; invalidated: boolean } = {
        updatedIds: [],
        invalidated: false,
      }
      perEventResults.set(event.id, eventDebug)

      // Pull the originating command id from event metadata up front so
      // staged results below can be attributed to it for `commandIdsByCollection`.
      // Same value is consumed later for id-resolution and drain tracking.
      const eventCommandId =
        typeof event.metadata === 'object' && event.metadata !== null
          ? ((event.metadata as { commandId?: unknown }).commandId as string | undefined)
          : undefined

      const targetKey = stateKey(primaryCollection.name, serverId)

      // Skip events targeting an entity we've already locked this batch.
      if (lockedEntityKeys.has(targetKey)) continue

      // Run the matching processors against current working state. Processor
      // lookup is persistence-scoped: Stateful events (typically snapshots)
      // use their own processor registrations and do not share lookups with
      // Permanent events. Stateful events also can't be trusted to carry
      // revision/position — on the server side those fields are reported
      // but are currently a lie for stateful streams (outstanding ddd-es
      // issue), so we pass `undefined` through the context to avoid
      // processors accidentally relying on bogus values.
      const eventPersistence = normalizeEventPersistence(event)
      const processors = this.eventProcessorRegistry.getProcessors(event.type, eventPersistence)
      let invalidated = false
      for (const processor of processors) {
        const context: ProcessorContext = {
          persistence: eventPersistence,
          commandId: undefined,
          revision: eventPersistence === 'Stateful' ? undefined : event.revision,
          position: eventPersistence === 'Stateful' ? undefined : event.position,
          streamId: event.streamId,
          eventId: event.id,
        }
        // Handler input state for server events is the current server
        // baseline for the target entity (not the client overlay) — the
        // server processor is producing new server truth.
        const inputState = serverStateByKey.get(targetKey)
        // Processors receive the event's `data` payload
        const result = processor(event.data, inputState as any, context)
        if (!result) continue
        if ('invalidate' in result) {
          invalidated = true
          break
        }
        const results = Array.isArray(result) ? result : [result]
        // Build the revision metadata for server-origin permanent writes.
        // Stateful events can't be trusted to carry a real revision/position
        // (see persistence branching comment above), so the metadata is
        // left undefined for them.
        const revisionMeta =
          eventPersistence === 'Permanent'
            ? { revision: String(event.revision), position: String(event.position) }
            : undefined

        for (const r of results) {
          const rowKey = entityIdToString(r.id as unknown as EntityId)
          if (typeof rowKey !== 'string') continue
          const rKey = stateKey(r.collection, rowKey)

          eventDebug.updatedIds.push(`${r.collection}:${rowKey}`)

          // Stage server-event processor results for deferred application
          // in Phase 6 of `reconcileAndPersist`. The pipeline contract is
          // "all reads up front, all writes at the end" so we don't touch
          // storage here — only the in-memory working state below. One
          // staged entry per active cache key keeps each subscriber's
          // record tagged consistently when the persist phase runs.
          // `serverStateByKey` (mirrored below) IS updated immediately so
          // Phase 5 reconcile can hand each re-running handler a fresh
          // post-event server baseline as input. `clientStateByKey` is
          // not touched here — it represents the client's separate overlay
          // projection and only changes via dirty-command re-runs in Phase 5.
          for (const ck of cacheKeys) {
            pendingApplications.push({ result: r, cacheKey: ck.key, revisionMeta })
          }
          recordModified(r.collection, rowKey)
          if (typeof eventCommandId === 'string') {
            recordCommandId(r.collection, eventCommandId)
          }

          const before = serverStateByKey.get(rKey)
          const after = applyOp(before, r.update)
          if (after === undefined) {
            if (before !== undefined) {
              serverStateByKey.delete(rKey)
              dirtyEntityKeys.add(rKey)
            }
          } else if (after !== before) {
            serverStateByKey.set(rKey, after)
            dirtyEntityKeys.add(rKey)
          }

          // Associate this entry with every cache key the triggering
          // server event carried so downstream persistence can tag any
          // Phase 5 overlay writes against those same keys.
          for (const ck of cacheKeys) {
            recordCacheKey(rKey, ck.key)
          }
        }
      }

      if (invalidated) {
        eventDebug.invalidated = true
        lockedEntityKeys.add(targetKey)
        const activeCacheKeys = cacheKeys.map((ck) => ck.key)
        for (const collection of matchingCollections) {
          this.invalidationScheduler.schedule(collection.name, activeCacheKeys)
        }
        // Deliberately do not add `targetKey` to `dirtyEntityKeys`. Dirty is
        // tracked per actual working-state mutation; invalidation is orthogonal.
        continue
      }

      // Detect id resolution via `event.metadata.commandId` (extracted at
      // the top of the per-event block). When the server echoes the
      // originating command's id in event metadata, we can correlate this
      // event back to a pending create command — the create's `tempId` is
      // being resolved to the event's `serverId`.
      if (typeof eventCommandId === 'string') {
        const pendingCreate = pendingCreatesByCommandId.get(eventCommandId)
        if (pendingCreate && pendingCreate.tempId !== serverId) {
          const ref = createEntityRef(
            pendingCreate.tempId,
            pendingCreate.createCommand.commandId,
            'temporary',
          )
          idMap.set(pendingCreate.tempId, {
            serverId,
            ref,
            revision: event.revision,
            aggregate: primaryCollection.aggregate,
          })
          tempIdsToDelete.add(stateKey(primaryCollection.name, pendingCreate.tempId))
        }
      }
    }

    await this.reconcileAndPersist({
      dirtyEntityKeys,
      serverStateByKey,
      clientStateByKey,
      cacheKeysByKey,
      modifiedByCollection,
      commandIdsByCollection,
      idMap,
      tempIdsToDelete,
      preloadedRecords,
      pendingApplications,
    })

    return perEventResults
  }

  /**
   * Shared reconcile-and-persist block.
   *
   * Every entry point that introduces server state (WS events, command
   * response events, gap repair, seed events, record-based seeds/refetches)
   * calls this after building its in-memory working state. The method:
   *
   *   1. Loads pending + succeeded commands and their primary-entity read
   *      models.
   *   2. Rewrites commands with any tempId→serverId resolutions (Phase 4).
   *   3. Re-runs pending commands whose primary entity shifted (Phase 5).
   *   4. Builds a single {@link ReadModelMutation} list covering id migrations,
   *      the entry-point's staged `pendingApplications`, Phase 5 client
   *      overlays, and `_clientMetadata` stamps; flushes it via one
   *      {@link ReadModelStore.commit} call (Phase 6). Emits
   *      `readmodel:updated` and handles the `'succeeded' → 'applied'`
   *      coverage transition.
   *
   * Callers are responsible for:
   *   - Staging processor results into `pendingApplications` (no direct
   *     storage writes).
   *   - Mirroring the post-event server baselines into `serverStateByKey` so
   *     Phase 5 handlers see fresh state.
   *   - Tracking dirty entity keys and modified entities.
   *   - Populating `idMap` + `tempIdsToDelete` if id resolution was detected.
   *   - Pre-loading entity records into `preloadedRecords` (for merge + metadata).
   */
  private async reconcileAndPersist(change: ServerStateChangeResult<TLink>): Promise<void> {
    const {
      dirtyEntityKeys,
      serverStateByKey,
      clientStateByKey,
      cacheKeysByKey,
      modifiedByCollection,
      commandIdsByCollection,
      idMap,
      tempIdsToDelete,
      preloadedRecords,
      pendingApplications,
    } = change

    const recordCommandIdForCollection = (collection: string, commandId: string): void => {
      let ids = commandIdsByCollection.get(collection)
      if (!ids) {
        ids = new Set()
        commandIdsByCollection.set(collection, ids)
      }
      ids.add(commandId)
    }

    const recordModified = (collection: string, id: string): void => {
      let ids = modifiedByCollection.get(collection)
      if (!ids) {
        ids = new Set()
        modifiedByCollection.set(collection, ids)
      }
      ids.add(id)
    }

    const recordCacheKey = (key: string, cacheKey: string): void => {
      let set = cacheKeysByKey.get(key)
      if (!set) {
        set = new Set<string>()
        cacheKeysByKey.set(key, set)
      }
      set.add(cacheKey)
    }

    // --- Load pending + succeeded commands and their primary-entity state ---
    //
    // Only loaded when the client has a domain executor configured; without
    // one there can be no handlers to re-run and Phase 4/5 are no-ops.
    //
    // `'succeeded'` is in scope because the pipeline owns the
    // `'succeeded' → 'applied'` transition: succeeded commands with
    // `creates.idStrategy === 'temporary'` still need their tempId→serverId
    // migration (Phase 3 + Phase 6 step 4), and the primary-aggregate
    // coverage check that drives `'applied'` runs against each succeeded
    // command's `serverResponse` and `knownRevisions` per batch.
    const commands = this.domainExecutor
      ? await this.commandStore.getByStatus(['pending', 'blocked', 'sending', 'succeeded'])
      : []

    interface PendingCreateResolution {
      tempId: string
      createCommand: CommandRecord<TLink, TCommand>
    }
    const pendingCreatesByCommandId = new Map<string, PendingCreateResolution>()

    // Load read model records for pending commands' primary entities that
    // weren't already loaded by the caller's entry-point-specific block.
    const pairsToLoad = new Map<string, { collection: string; id: string }>()
    if (this.domainExecutor) {
      for (const command of commands) {
        const registration = this.domainExecutor.getRegistration(command.type)
        if (!registration) continue
        const primaryCollection = this.primaryCollectionResolver.resolve(registration)
        if (!primaryCollection) continue
        const entityId = this.commandQueue.getEntityIdForCommand(command)
        if (!entityId) continue
        const key = stateKey(primaryCollection.name, entityId)
        if (!preloadedRecords.has(key) && !pairsToLoad.has(key)) {
          pairsToLoad.set(key, { collection: primaryCollection.name, id: entityId })
        }
        if (command.creates && command.creates.idStrategy === 'temporary') {
          pendingCreatesByCommandId.set(command.commandId, {
            tempId: entityId,
            createCommand: command,
          })
        }
      }
    }

    // Partition commands by status. Succeeded commands only participate in
    // the `'succeeded' → 'applied'` coverage evaluation (below); they are
    // excluded from Phase 4 data rewriting and Phase 5 anticipated-event
    // regeneration, both of which only make sense for not-yet-sent commands.
    const succeededCommands: CommandRecord<TLink, TCommand>[] = []
    const activeCommands: CommandRecord<TLink, TCommand>[] = []
    for (const command of commands) {
      if (command.status === 'succeeded') {
        succeededCommands.push(command)
      } else {
        activeCommands.push(command)
      }
    }

    // Coverage evaluation — produces the `'succeeded' → 'applied'` transition
    // set plus any `'succeeded'` commands whose coverage record shrank this
    // batch. Writes happen at the very end of `reconcileAndPersist`, after
    // all existing Phase 6 writes, so failures in coverage evaluation do
    // not partially roll back the batch.
    const coverage = this.evaluateCoverageForBatch(succeededCommands)

    // Merge preloaded records (event targets from the caller) with any
    // additional command-primary records into a single lookup map. Used by
    // Phase 5 for handler state input and Phase 6 step 5 for
    // `_clientMetadata` capture during tempId→serverId mapping.
    const allLoadedRecords = new Map<string, ReadModel>(preloadedRecords)
    if (pairsToLoad.size > 0) {
      const additionalRecords = await this.readModelStore.getManyByCollectionIds(
        pairsToLoad.values(),
      )
      for (const [key, record] of additionalRecords) {
        allLoadedRecords.set(key, record)
        if (record.serverData && typeof record.serverData === 'object') {
          serverStateByKey.set(key, record.serverData as object)
        }
        if (record.data && typeof record.data === 'object') {
          clientStateByKey.set(key, record.data as object)
        }
      }
    }

    // --- Phase 6: build the batched read-model mutation list ---
    //
    // The pipeline contract is "all reads up front, all writes at the end."
    // Phase 3 staged its server-event writes into `pendingApplications`; the
    // Phase 5 client-overlay writes are appended further down; `_clientMetadata`
    // stamps are appended last (after command-id mappings are saved). A single
    // `readModelStore.commit(mutations)` call near the end of this method
    // flushes the whole batch, with migrations running first as in-place row
    // renames so later ops targeting tempIds land on the migrated serverIds.
    const mutations: ReadModelMutation[] = []

    // Id-resolution migrations (tempId → serverId). The modified-collection
    // emission records both ids so reactive consumers re-read both.
    for (const key of tempIdsToDelete) {
      const sep = key.indexOf(':')
      if (sep < 0) continue
      const collection = key.slice(0, sep)
      const tempId = key.slice(sep + 1)
      const resolution = idMap.get(tempId)
      if (!resolution) continue
      mutations.push({ kind: 'migrateId', collection, fromId: tempId, toId: resolution.serverId })
      recordModified(collection, tempId)
      recordModified(collection, resolution.serverId)
    }

    // Deferred server-event writes from Phase 3 (or from the `onApplyRecords`
    // per-record loop for seed pages). Map each processor result onto the
    // corresponding mutation kind so the batched commit applies the same
    // side effects the old per-row setters did.
    for (const app of pendingApplications) {
      const rowId = entityIdToString(app.result.id as unknown as EntityId)
      if (typeof rowId !== 'string') continue
      const update = app.result.update
      if (update.type === 'delete') {
        mutations.push({ kind: 'delete', collection: app.result.collection, id: rowId })
        continue
      }
      if (update.type === 'set') {
        mutations.push({
          kind: app.result.isServerUpdate ? 'setServer' : 'setLocal',
          collection: app.result.collection,
          id: rowId,
          data: update.data as object,
          cacheKey: app.cacheKey,
          ...(app.result.isServerUpdate ? { revisionMeta: app.revisionMeta } : {}),
        } as ReadModelMutation)
        continue
      }
      if (update.type === 'merge') {
        mutations.push({
          kind: app.result.isServerUpdate ? 'mergeServer' : 'applyLocal',
          collection: app.result.collection,
          id: rowId,
          data: update.data as object,
          cacheKey: app.cacheKey,
          ...(app.result.isServerUpdate ? { revisionMeta: app.revisionMeta } : {}),
        } as ReadModelMutation)
      }
    }

    // If there's no domain executor and no id resolutions to persist, the
    // remaining Phase 4-6 work is a no-op — flush the mutation list gathered
    // so far (pendingApplications + any migrations) and emit.
    if (!this.domainExecutor && idMap.size === 0) {
      if (mutations.length > 0) {
        await this.readModelStore.commit(mutations)
      }
      for (const [collection, ids] of modifiedByCollection) {
        this.eventBus.emit('readmodel:updated', {
          collection,
          ids: Array.from(ids),
          commandIds: Array.from(commandIdsByCollection.get(collection) ?? []),
        })
      }
      return
    }

    // --- Phase 4: rewrite pending command data using idMap ---
    //
    // For each pending command, walk its declared `commandIdReferences` via
    // `rewriteCommandWithIdMap`, replacing resolved tempIds with serverIds
    // and pruning the matching `commandIdPaths` entries. Commands whose
    // `commandIdReferences` is empty (top-level creates) are a no-op.
    //
    // Each rewritten command is stored in `rewrittenCommandsById` keyed by
    // commandId. The command's post-rewrite primary entity key is promoted
    // to `dirtyEntityKeys` so the forward-walk reconcile loop re-executes
    // it against the updated data.
    const rewrittenCommandsById = new Map<string, CommandRecord<TLink, TCommand>>()
    if (idMap.size > 0 && this.domainExecutor) {
      const rewriteEntries: RewriteIdEntry<TLink>[] = []
      for (const [clientId, resolution] of idMap) {
        rewriteEntries.push({
          clientId,
          serverId: resolution.serverId,
          aggregate: resolution.aggregate,
        })
      }

      for (const command of activeCommands) {
        const registration = this.domainExecutor.getRegistration(command.type)
        if (!registration) continue

        const rewriteResult = rewriteCommandWithIdMap(
          command,
          command.commandIdPaths,
          rewriteEntries,
          registration.commandIdReferences,
        )

        if (!rewriteResult.changed) continue

        const rewritten: CommandRecord<TLink, TCommand> = {
          ...command,
          data: rewriteResult.data as CommandRecord<TLink, TCommand>['data'],
          path: rewriteResult.path,
          commandIdPaths: rewriteResult.commandIdPaths,
          updatedAt: Date.now(),
        }
        rewrittenCommandsById.set(command.commandId, rewritten)

        const primaryCollection = this.primaryCollectionResolver.resolve(registration)
        if (primaryCollection) {
          const entityId = this.commandQueue.getEntityIdForCommand(rewritten)
          if (entityId) {
            dirtyEntityKeys.add(stateKey(primaryCollection.name, entityId))
          }
        }
      }
    }

    const finalCommands: readonly CommandRecord<TLink, TCommand>[] =
      rewrittenCommandsById.size > 0
        ? activeCommands.map((c) => rewrittenCommandsById.get(c.commandId) ?? c)
        : activeCommands

    // --- Phase 5: reconcile pending commands against the new server state ---
    //
    // Only runs when a domain executor is configured (otherwise there are
    // no handlers to re-run). The output feeds Phase 6's client-overlay
    // writes and anticipated-event replacement.
    let output: ReconcileOutput | undefined
    let preReconcileClientState: Map<string, object> | undefined

    if (this.domainExecutor) {
      const anticipatedEventsByCommand = new Map<string, IAnticipatedEvent[]>()
      const anticipatedRecords = await this.eventCache.getAllAnticipatedEvents()
      for (const record of anticipatedRecords) {
        if (!record.commandId) continue
        const data =
          typeof record.data === 'string' ? (JSON.parse(record.data) as unknown) : record.data
        if (!data || typeof data !== 'object') continue
        const event: IAnticipatedEvent = {
          type: record.type,
          streamId: record.streamId,
          data: data as IAnticipatedEvent['data'],
        }
        let bucket = anticipatedEventsByCommand.get(record.commandId)
        if (!bucket) {
          bucket = []
          anticipatedEventsByCommand.set(record.commandId, bucket)
        }
        bucket.push(event)
      }

      const getProcessors: ReconcileInput<TLink, TCommand, TSchema, TEvent>['getProcessors'] = (
        eventType,
      ) => this.eventProcessorRegistry.getProcessors(eventType, 'Anticipated')

      const buildProcessorContext: ReconcileInput<
        TLink,
        TCommand,
        TSchema,
        TEvent
      >['buildProcessorContext'] = (event, command) => {
        const e = event as { id?: unknown; streamId?: unknown }
        return {
          persistence: 'Anticipated',
          commandId: command.commandId,
          streamId: typeof e.streamId === 'string' ? e.streamId : '',
          eventId: typeof e.id === 'string' ? e.id : '',
        }
      }

      preReconcileClientState = new Map(clientStateByKey)

      output = reconcilePendingCommands<TLink, TCommand, TSchema, TEvent>({
        initialDirty: dirtyEntityKeys,
        commands: finalCommands,
        anticipatedEventsByCommand,
        initialServerState: serverStateByKey,
        initialClientState: clientStateByKey,
        primaryCollectionResolver: this.primaryCollectionResolver,
        domainExecutor: this.domainExecutor,
        getProcessors,
        getEntityIdForCommand: (command) => this.commandQueue.getEntityIdForCommand(command),
        buildProcessorContext,
      })

      for (const command of finalCommands) {
        const newEvents = output.updatedAnticipatedEvents.get(command.commandId)
        const events = newEvents ?? anticipatedEventsByCommand.get(command.commandId) ?? []
        const trackedEntries: string[] = []
        for (const rawEvent of events) {
          if (typeof rawEvent !== 'object' || rawEvent === null) continue
          const event = rawEvent as IAnticipatedEvent
          const collection = this.collections.find((c) => c.matchesStream(event.streamId))
          if (!collection) continue
          const entityId = entityIdToString(event.data.id)
          if (!entityId) continue
          recordCacheKey(stateKey(collection.name, entityId), command.cacheKey.key)
          trackedEntries.push(`${collection.name}:${entityId}`)
          // Attribute this collection's update to the re-run command so the
          // readmodel:updated emit carries the right commandIds. Only commands
          // whose handler re-ran (`newEvents` defined) contributed fresh
          // effects this batch.
          if (newEvents) {
            recordCommandIdForCollection(collection.name, command.commandId)
          }
        }
        // Update the anticipated handler's tracking map for re-run commands
        // so getTrackedEntries and cleanup operate on the correct entity set.
        if (newEvents && trackedEntries.length > 0) {
          this.anticipatedEventHandler.setTrackedEntries(command.commandId, trackedEntries)
        }
      }
    }

    // --- Phase 6: persist ---
    //
    // Write order: commands first (durable source of truth), then anticipated
    // events, then read models, then mapping records. All preloaded and ready
    // in memory — no reads into storage during the phase except for a narrow
    // fallback in step 5 that's noted inline.
    //
    // Filtering rules (per earlier directional calls):
    //   - Read model writes in step 3 are restricted to entries in
    //     `output.finalDirty` (untouched entries pass through).
    //   - Entries in `tempIdsToDelete` are removed from the write set in
    //     step 3 and deleted outright in step 4 — no write-then-delete churn.

    // Re-derive affectedAggregates for rewritten commands whose handler
    // was re-run in Phase 5. The new anticipated events carry corrected
    // streamIds (server IDs instead of tempIds), so affectedAggregates
    // must be updated to match.
    if (output && rewrittenCommandsById.size > 0) {
      for (const [commandId, rewritten] of rewrittenCommandsById) {
        const newEvents = output.updatedAnticipatedEvents.get(commandId)
        if (!newEvents) continue
        const anticipatedEvents = newEvents as IAnticipatedEvent[]
        const result = deriveAffectedAggregates(this.clientAggregates, anticipatedEvents)
        if (result.ok) {
          rewrittenCommandsById.set(commandId, {
            ...rewritten,
            affectedAggregates: result.value,
          })
        } else {
          logProvider.log.warn(
            { commandId, error: result.error.message },
            'Failed to re-derive affectedAggregates for rewritten command',
          )
        }
      }
    }

    // Steps 1-3 only run when Phase 5 produced output (domainExecutor present).
    // Step 1: save rewritten commands in one bulk update.
    if (output && rewrittenCommandsById.size > 0) {
      const updates: Array<{
        commandId: string
        updates: Partial<CommandRecord<TLink, TCommand>>
      }> = []
      for (const [commandId, rewritten] of rewrittenCommandsById) {
        updates.push({
          commandId,
          updates: {
            data: rewritten.data,
            commandIdPaths: rewritten.commandIdPaths,
            affectedAggregates: rewritten.affectedAggregates,
            updatedAt: rewritten.updatedAt,
          },
        })
      }
      this.commandStore.batchUpdate(updates)
    }

    // Step 2: replace cached anticipated events for every re-run command.
    // Bulk delete the old records, then bulk insert freshly-minted records
    // for the new events. Clean commands (not in `updatedAnticipatedEvents`)
    // keep their existing overlays untouched.
    if (output && output.updatedAnticipatedEvents.size > 0) {
      const regeneratedCommandIds: string[] = Array.from(output.updatedAnticipatedEvents.keys())
      await this.storage.deleteAnticipatedEventsByCommands(regeneratedCommandIds)

      const finalCommandsById = new Map<string, CommandRecord<TLink, TCommand>>()
      for (const command of finalCommands) {
        finalCommandsById.set(command.commandId, command)
      }

      const cachedRecords: CachedEventRecord[] = []
      const now = Date.now()
      for (const [commandId, events] of output.updatedAnticipatedEvents) {
        const command = finalCommandsById.get(commandId)
        if (!command) continue
        for (const rawEvent of events) {
          if (typeof rawEvent !== 'object' || rawEvent === null) continue
          const event = rawEvent as IAnticipatedEvent
          cachedRecords.push({
            id: generateId(),
            type: event.type,
            streamId: event.streamId,
            persistence: 'Anticipated',
            data: JSON.stringify(event.data),
            position: null,
            revision: null,
            commandId,
            cacheKeys: [command.cacheKey.key],
            createdAt: now,
            processedAt: null,
          })
        }
      }
      if (cachedRecords.length > 0) {
        await this.storage.saveCachedEvents(cachedRecords)
      }
    }

    // Step 3: stage client-overlay mutations for any entries the Phase 5
    // reconcile fold actually modified. Server-origin writes come from the
    // deferred `pendingApplications`; this step handles only the optimistic
    // local overlays Phase 5 computed on top.
    //
    // Detection: compare each dirty key's current value in
    // `output.finalClientState` against `preReconcileClientState`.
    //   - `postValue` absent + `preValue` present → overlay cleared → emit `delete`.
    //   - `postValue === preValue` → overlay unchanged → skip.
    //   - otherwise → new overlay → emit `setLocal` (one mutation per cacheKey;
    //     `commit` collects the full association set across ops).
    //
    // Entries in `tempIdsToDelete` are skipped here — they're being
    // migrated in place via the `migrateId` mutation staged in the prologue.
    const finalDirty = output?.finalDirty ?? new Set<string>()
    for (const key of finalDirty) {
      if (tempIdsToDelete.has(key)) continue
      const separator = key.indexOf(':')
      if (separator < 0) continue
      const collectionName = key.slice(0, separator)
      const entityId = key.slice(separator + 1)
      const preValue = preReconcileClientState?.get(key)
      const postValue = output?.finalClientState.get(key)

      if (postValue === undefined) {
        if (preValue !== undefined) {
          mutations.push({ kind: 'delete', collection: collectionName, id: entityId })
          recordModified(collectionName, entityId)
        }
        continue
      }

      if (postValue === preValue) continue

      const cacheKeysForKey = cacheKeysByKey.get(key)
      if (!cacheKeysForKey || cacheKeysForKey.size === 0) {
        logProvider.log.warn(
          { key },
          'Reconcile persist: no cacheKey tracked for dirty read-model entry',
        )
        continue
      }
      recordModified(collectionName, entityId)
      for (const ck of cacheKeysForKey) {
        mutations.push({
          kind: 'setLocal',
          collection: collectionName,
          id: entityId,
          data: postValue,
          cacheKey: ck,
        })
      }
    }

    // Step 5: save the idMap as CommandIdMappingRecord entries so the UI can
    // patch stale client ids on future enqueues until the TTL expires.
    if (idMap.size > 0) {
      const createdAt = Date.now()
      const mappingRecords: CommandIdMappingRecord[] = Array.from(
        idMap,
        ([tempId, resolution]) => ({
          clientId: tempId,
          serverId: resolution.serverId,
          createdAt,
        }),
      )
      this.mappingStore.saveMany(mappingRecords)
    }

    // Step 6: stage `_clientMetadata` stamps for serverId entries that this
    // session created. A mapping at `serverId` exists iff this session issued
    // the create (both writers — Step 5 above and CommandQueue's response
    // cascade — only record mappings for our own commands), so the existence
    // of the mapping is the gate. The stamp value is `mapping.clientId` — the
    // tempId the UI originally held. The batched commit's fold applies these
    // on top of whatever other ops the row accumulated this batch (server
    // writes, migrations, overlays), then saves once.
    const metadataStampedAt = Date.now()
    for (const [collection, ids] of modifiedByCollection) {
      for (const id of ids) {
        const mapping = this.mappingStore.getByServerId(id)
        if (!mapping) continue
        mutations.push({
          kind: 'setClientMetadata',
          collection,
          id,
          metadata: {
            clientId: mapping.clientId,
            reconciledAt: metadataStampedAt,
          },
        })
      }
    }

    // Final write: single batched commit over the full mutation list
    // assembled across Phase 3 deferral, id-resolution migrations, Phase 5
    // client overlays, and `_clientMetadata` stamps. Preserves every
    // side effect of the old per-row setter path (three-way merge, no-op
    // short-circuit, cacheKey preservation, revision/position handling).
    if (mutations.length > 0) {
      await this.readModelStore.commit(mutations)
    }

    // Emit `readmodel:updated` once per collection so reactive queries and
    // UI subscriptions refresh. Aggregated across all phases — Phase 3
    // (server writes), Phase 6 step 3 (client overlay writes), and
    // Phase 6 step 4 (tempId deletions).
    for (const [collection, ids] of modifiedByCollection) {
      this.eventBus.emit('readmodel:updated', {
        collection,
        ids: Array.from(ids),
        commandIds: Array.from(commandIdsByCollection.get(collection) ?? []),
      })
    }

    // Advance aggregate chain revisions from server data so AutoRevision
    // commands resolve against the latest confirmed revision.
    // Two sources: knownRevisions (WS events + record revision metadata)
    // and record data via collection.revisionPath (for seed/refetch records).
    const chainRevisionUpdates: Array<{ streamId: string; revision: string }> = []
    for (const [streamId, revision] of this.knownRevisions) {
      chainRevisionUpdates.push({ streamId, revision: revision.toString() })
    }
    for (const app of change.pendingApplications) {
      const collection = this.collections.find((c) => c.name === app.result.collection)
      if (!collection?.revisionPath) continue
      const revValue = getAtPath(
        app.result.update.type !== 'delete' ? app.result.update.data : undefined,
        collection.revisionPath,
      )
      if (typeof revValue === 'string') {
        const streamId = collection.aggregate.getStreamId(app.result.id)
        chainRevisionUpdates.push({ streamId, revision: revValue })
      }
    }
    if (chainRevisionUpdates.length > 0) {
      this.commandQueue.advanceChainRevisions(chainRevisionUpdates)
    }

    // Pipeline-owned `'succeeded' → 'applied'` transition. Writes happen AFTER
    // all existing Phase 6 steps so coverage writes don't contend with the
    // main reconcile output. Applied commands' EventCache + anticipatedUpdates
    // cleanup runs alongside.
    if (coverage.applied.length > 0) {
      await this.commandQueue.batchUpdateSyncStatus({ applied: coverage.applied })
      const appliedIds = coverage.applied.map((c) => c.commandId)
      await this.anticipatedEventHandler.cleanupOnAppliedBatch(appliedIds)
    }

    // Flush any command store changes accumulated during this pipeline run
    await this.commandStore.flush()
  }

  /**
   * Evaluate the `'succeeded' → 'applied'` transition for every in-scope
   * succeeded command in this batch.
   *
   * Detection rules (all based on server-authoritative state):
   *   - **Cache key evicted** — `cacheManager.existsSync(command.cacheKey.key)`
   *     returns false → applied. The read-model entries that would have
   *     carried this command's revision are gone, so we can't prove coverage
   *     any other way; slipping is preferable to leaving the command
   *     `'succeeded'` forever.
   *   - **Primary-aggregate revision covers** — for the command's primary
   *     aggregate (from `registration.aggregate`), compare post-batch
   *     `knownRevisions[primaryStreamId]` to `response.nextExpectedRevision`.
   *     `>=` means every revision up to and including the command's own
   *     events has been seen by the read model. Secondary aggregates are
   *     intentionally ignored — the contract is "primary aggregate applied."
   *
   * Commands without a registration are skipped here — they were slipped to
   * `'applied'` at succeed time in `CommandQueue` via its escape hatch.
   *
   * Returns only the set of commands transitioning to `'applied'`; commands
   * not yet covered stay `'succeeded'` and are re-evaluated next batch when
   * more state advances.
   */
  protected evaluateCoverageForBatch(
    succeededCommands: readonly CommandRecord<TLink, TCommand>[],
  ): {
    applied: CommandRecord<TLink, TCommand>[]
  } {
    const applied: CommandRecord<TLink, TCommand>[] = []

    for (const command of succeededCommands) {
      if (!this.domainExecutor) continue
      const registration = this.domainExecutor.getRegistration(command.type)
      if (!registration || !registration.aggregate) continue

      // Cache-key-evicted slip — state has been dropped, nothing to prove against.
      if (!this.cacheManager.existsSync(command.cacheKey.key)) {
        applied.push(command)
        continue
      }

      const primaryEntityId = this.readResponseField(command.serverResponse, 'id')
      if (primaryEntityId === undefined) continue
      const nextExpectedRevisionRaw = this.readResponseField(
        command.serverResponse,
        'nextExpectedRevision',
      )
      if (nextExpectedRevisionRaw === undefined) continue
      const expected = parseExpectedRevision(nextExpectedRevisionRaw)
      if (expected === undefined) continue

      const primaryStreamId = registration.aggregate.getStreamId(primaryEntityId)
      const current = this.knownRevisions.get(primaryStreamId)
      if (current === undefined) continue

      if (current >= expected) {
        applied.push(command)
      }
    }

    return { applied }
  }

  private readResponseField(response: unknown, field: string): string | undefined {
    if (typeof response !== 'object' || response === null) return undefined
    if (!(field in response)) return undefined
    const value = (response as Record<string, unknown>)[field]
    if (typeof value === 'string') return value
    return undefined
  }

  /**
   * Update lastSyncedPosition for all active cache keys across matching collections.
   */
  private updateSeedStatusPosition(
    collections: Collection<TLink>[],
    activeCacheKeys: string[],
    position: bigint,
  ): void {
    for (const collection of collections) {
      for (const cacheKey of activeCacheKeys) {
        if (this.seedStatus.has(collection.name, cacheKey)) {
          this.seedStatus.update(collection.name, cacheKey, {
            lastSyncedPosition: position,
          })
        }
      }
    }
  }

  /**
   * Clear known revisions for specific streams.
   * Used when a cache key is evicted and the associated stream state is no longer valid.
   */
  clearKnownRevisions(streamIds: string[]): void {
    for (const streamId of streamIds) {
      this.knownRevisions.delete(streamId)
    }
  }
}
