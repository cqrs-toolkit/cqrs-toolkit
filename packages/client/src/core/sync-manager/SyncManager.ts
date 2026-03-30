/**
 * Sync manager orchestrates data synchronization between client and server.
 *
 * Responsibilities:
 * - Coordinate collection seeding
 * - Handle WebSocket event streams
 * - Manage gap repair
 * - Trigger command processing
 */

import { parseServerMessage, serializeClientMessage } from '@cqrs-toolkit/realtime'
import { Link, Ok, Result, logProvider } from '@meticoeus/ddd-es'
import { Subject, Subscription, filter, firstValueFrom, takeUntil } from 'rxjs'
import type {
  Collection,
  CollectionWithSeedOnDemand,
  FetchContext,
  NetworkConfig,
} from '../../types/config.js'
import { hydrateSerializedEvent, normalizeEventPersistence } from '../../types/events.js'
import { noop } from '../../utils/index.js'
import type { AuthStrategy } from '../auth.js'
import { type CacheKeyIdentity, matchesCacheKey } from '../cache-manager/CacheKey.js'
import type { CacheManager } from '../cache-manager/CacheManager.js'
import type { IAnticipatedEvent } from '../command-lifecycle/AnticipatedEventShape.js'
import type { CommandQueue } from '../command-queue/CommandQueue.js'
import type { EventCache } from '../event-cache/EventCache.js'
import type { EventProcessorRunner, ParsedEvent } from '../event-processor/index.js'
import type { EventBus } from '../events/EventBus.js'
import type { QueryManager } from '../query-manager/QueryManager.js'
import type { ReadModelStore } from '../read-model-store/ReadModelStore.js'
import type { SessionManager } from '../session/SessionManager.js'
import { IWriteQueue, WriteQueueException } from '../write-queue/IWriteQueue.js'
import type { ApplyRecordsOp, ApplySeedEventsOp } from '../write-queue/operations.js'
import { ApplyWsEventOp, EvictCacheKeyOp } from '../write-queue/operations.js'
import { ConnectivityManager } from './ConnectivityManager.js'
import { GapRepairCoordinator } from './GapRepairCoordinator.js'
import { InvalidationScheduler } from './InvalidationScheduler.js'
import type { CollectionSyncStatus } from './SeedStatusIndex.js'
import { SeedStatusIndex } from './SeedStatusIndex.js'
import { toParsedEvent } from './SyncManagerUtils.js'

/**
 * Sync manager.
 */
export class SyncManager<TLink extends Link, TSchema, TEvent extends IAnticipatedEvent> {
  private readonly connectivity: ConnectivityManager<TLink>
  private readonly gapRepair: GapRepairCoordinator<TLink>
  protected readonly invalidationScheduler: InvalidationScheduler<TLink>

  /** Mutable — recreated on each start() so takeUntil subscriptions work after stop()/start() cycles. */
  private destroy$ = new Subject<void>()

  private readonly seedStatus = new SeedStatusIndex()
  private wsConnection: WebSocket | undefined
  private subscriptions: Subscription[] = []
  private abortController: AbortController | undefined

  /** Single-flight guard for startSync — prevents overlapping syncs and captures rejections. */
  private startSyncPromise: Promise<void> | undefined

  /** Active WS topic subscriptions per cache key. Used for reconnect re-subscribe and eviction unsubscribe. */
  private readonly topicsByCacheKey = new Map<string, Set<string>>()

  /** Highest applied revision per stream. Initialized during seeding, advanced on happy-path processing. */
  protected readonly knownRevisions = new Map<string, bigint>()

  /** True while setAuthenticated/setUnauthenticated is handling the wipe inline. */
  private sessionDestroyHandledInline = false

  constructor(
    private readonly eventBus: EventBus<TLink>,
    private readonly sessionManager: SessionManager<TLink>,
    private readonly commandQueue: CommandQueue<TLink, TSchema, TEvent>,
    private readonly eventCache: EventCache<TLink>,
    private readonly cacheManager: CacheManager<TLink>,
    private readonly eventProcessor: EventProcessorRunner<TLink>,
    private readonly readModelStore: ReadModelStore<TLink>,
    private readonly queryManager: QueryManager<TLink>,
    private readonly writeQueue: IWriteQueue<TLink>,
    private readonly networkConfig: NetworkConfig,
    private readonly auth: AuthStrategy,
    private readonly collections: Collection<TLink>[],
  ) {
    // Initialize connectivity manager
    this.connectivity = new ConnectivityManager({
      eventBus: this.eventBus,
      healthCheckUrl: `${this.networkConfig.baseUrl}/health`,
    })

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
      this.eventProcessor,
      this.readModelStore,
      this.collections,
      this.connectivity,
      this.writeQueue,
      {
        getFetchContext: () => this.buildFetchContext(),
        onInvalidated: (collectionName, cacheKeys) =>
          this.invalidationScheduler.schedule(collectionName, cacheKeys),
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
    this.writeQueue.register('apply-ws-event', this.onApplyWsEventOp.bind(this))
    this.writeQueue.registerEviction('apply-ws-event', noop)
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
      .subscribe(() => {
        if (this.sessionDestroyHandledInline) return
        this.onSessionDestroyed().catch((err) => {
          logProvider.log.error({ err }, 'onSessionDestroyed failed')
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
        // by CacheManager<TLink> which produced the identity from a TLink-typed source.
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
  public getConnectivity(): ConnectivityManager<TLink> {
    return this.connectivity
  }

  /**
   * Get sync status for a collection.
   */
  public getCollectionStatus(collection: string): CollectionSyncStatus | undefined {
    return this.seedStatus.firstForCollection(collection)
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

  /** Force-sync a specific collection from the server. */
  // TODO: remove this method
  public async syncCollection(collection: string): Promise<void> {}

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
    await firstValueFrom(
      this.eventBus
        .on('cache:seed-settled')
        .pipe(filter((e) => e.data.cacheKey.key === cacheKey.key)),
    )

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
  public async seedForKey(cacheKey: CacheKeyIdentity<TLink>): Promise<void> {
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
        await this.onSessionDestroyed()
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
        await this.onSessionDestroyed()
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
    // Pause command processing
    this.commandQueue.pause()
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
      this.eventBus.emit('readmodel:updated', { collection: collection.name, ids: [] })
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

    // Resume command processing
    this.commandQueue.resume()

    // Seed collections configured with seedOnInit
    await this.startSeedOnInit()
    // TODO: resume seedOnDemand collections from persisted cache keys (spec §4.8)
    // On restart, consult stored cache keys in the DB to determine what to
    // re-seed and in what order (held > recent > frozen).

    // Connect WebSocket for real-time updates
    this.connectWebSocket()

    // Process pending commands
    await this.commandQueue.processPendingCommands()
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
    // Unlike seedWithEvents (where EventProcessorRunner emits per-event),
    // record-based seeding writes directly to storage, so a single bulk
    // notification is needed after all pages are loaded.
    // Always emit, even for zero records — consumers need the signal to
    // resolve loading state for genuinely empty collections.
    this.eventBus.emit('readmodel:updated', { collection: collection.name, ids: [] })

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
          cacheKey: cacheKey.key,
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
   * Writes a page of seed/refetch records to the read model store and updates revision tracking.
   */
  private async onApplyRecords(op: ApplyRecordsOp<TLink>): Promise<void> {
    const collection = this.collections.find((c) => c.name === op.collection)

    for (const record of op.records) {
      const revisionMeta = record.revision
        ? { revision: record.revision, position: record.position }
        : undefined
      await this.readModelStore.setServerData(
        op.collection,
        record.id,
        record.data,
        op.cacheKey.key,
        revisionMeta,
      )

      if (record.revision && collection?.getStreamId) {
        const streamId = collection.getStreamId(record.id)
        const revBigint = BigInt(record.revision)
        const current = this.knownRevisions.get(streamId)
        if (current === undefined || revBigint > current) {
          this.knownRevisions.set(streamId, revBigint)
          this.eventCache.setKnownPosition(streamId, revBigint)
        }
      }
    }
  }

  /**
   * Write queue handler for apply-seed-events.
   * Caches events, processes them through event processors, and tracks revisions.
   */
  private async onApplySeedEvents(op: ApplySeedEventsOp): Promise<void> {
    await this.eventCache.cacheServerEvents(op.events, { cacheKeys: [op.cacheKey] })

    const parsedEvents = op.events.map((e) => toParsedEvent(e, op.cacheKey))
    await this.eventProcessor.processEvents(parsedEvents)

    for (const event of op.events) {
      const persistence = normalizeEventPersistence(event)
      if (persistence === 'Permanent') {
        const current = this.knownRevisions.get(event.streamId)
        if (current === undefined || event.revision > current) {
          this.knownRevisions.set(event.streamId, event.revision)
        }
      }
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
   * `cacheKeysFromTopics` to derive the cache keys deterministically.
   */
  protected resolveCacheKeysFromTopics(
    streamId: string,
    topics: readonly string[],
  ): CacheKeyIdentity<TLink>[] {
    const matchingCollections = this.getMatchingCollections(streamId)
    const seen = new Set<string>()
    const keys: CacheKeyIdentity<TLink>[] = []
    for (const collection of matchingCollections) {
      for (const cacheKey of collection.cacheKeysFromTopics(topics)) {
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
                this.writeQueue
                  .enqueue({
                    type: 'apply-ws-event',
                    event: wsEvent,
                    cacheKeys: wsCacheKeys,
                  })
                  .catch(noop)
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
   * Handle a WebSocket event with pre-resolved cache keys.
   * Per-stream gap detection: check AFTER caching, repair inline when gaps exist.
   */
  protected async onApplyWsEventOp(op: ApplyWsEventOp<TLink>): Promise<void> {
    const { event, cacheKeys } = op
    const matchingCollections = this.getMatchingCollections(event.streamId)
    const [primaryCollection] = matchingCollections
    if (!primaryCollection) return

    this.eventBus.emitDebug('sync:ws-event-received', { event })

    const activeCacheKeys = cacheKeys.map((ck) => ck.key)
    if (activeCacheKeys.length === 0) return

    // Cache event once with all active keys
    const cached = await this.eventCache.cacheServerEvent(event, { cacheKeys: activeCacheKeys })
    if (!cached) {
      // Event already exists — add any new cache key associations
      await this.eventCache.addCacheKeysToEvent(event.id, activeCacheKeys)
      return
    }

    const persistence = normalizeEventPersistence(event)

    // Stateful events skip revision checks — applied best-effort and processed immediately (spec §4.7)
    if (persistence === 'Stateful') {
      for (const cacheKey of activeCacheKeys) {
        const parsed = toParsedEvent(event, cacheKey)
        const result = await this.eventProcessor.processEvent(parsed)

        this.eventBus.emitDebug('sync:ws-event-processed', {
          event,
          updatedIds: result.updatedIds,
          invalidated: result.invalidated,
        })

        if (result.invalidated) {
          for (const collection of matchingCollections) {
            this.invalidationScheduler.schedule(collection.name, activeCacheKeys)
          }
        }
      }

      this.updateSeedStatusPosition(matchingCollections, activeCacheKeys, event.position)
      return
    }

    // Permanent events: check revision ordering and repair if gap detected
    const gapStatus = this.gapRepair.checkAndRepairGap(
      event,
      primaryCollection.name,
      activeCacheKeys,
    )
    switch (gapStatus) {
      case 'has-gap':
        return
      case 'invalidated':
        for (const collection of matchingCollections) {
          this.invalidationScheduler.schedule(collection.name, activeCacheKeys)
        }
        return
    }

    // Happy path — expected revision, process for each active cache key
    for (const cacheKey of activeCacheKeys) {
      const parsed = toParsedEvent(event, cacheKey)
      const result = await this.eventProcessor.processEvent(parsed)

      this.eventBus.emitDebug('sync:ws-event-processed', {
        event,
        updatedIds: result.updatedIds,
        invalidated: result.invalidated,
      })

      if (result.invalidated) {
        for (const collection of matchingCollections) {
          this.invalidationScheduler.schedule(collection.name, activeCacheKeys)
        }
      }
    }

    // Advance known revision
    this.knownRevisions.set(event.streamId, event.revision)

    // Clear this event from gap buffer and advance known position
    this.eventCache.clearGapBuffer(event.streamId, event.revision)
    this.eventCache.setKnownPosition(event.streamId, event.revision)

    this.updateSeedStatusPosition(matchingCollections, activeCacheKeys, event.position)
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

  /**
   * Process command response events.
   * Events are processed immediately for fast UI feedback. If a gap is detected
   * (response revision > expected), a collection refetch is scheduled to fill in
   * missing events asynchronously.
   */
  async processResponseEvents(events: ParsedEvent[]): Promise<void> {
    for (const event of events) {
      // 1. Cache for WS dedup (INSERT OR IGNORE)
      await this.eventCache.cacheResponseEvent(event)

      // 2. Process immediately for read model update
      await this.eventProcessor.processEvent(event)

      // 3. For Permanent events, check revision continuity
      if (event.persistence === 'Permanent' && event.revision !== undefined) {
        const expected = (this.knownRevisions.get(event.streamId) ?? -1n) + 1n

        if (event.revision !== expected) {
          // Gap detected — schedule async collection refetch for self-healing
          const matchingCollections = this.getMatchingCollections(event.streamId)
          for (const collection of matchingCollections) {
            this.invalidationScheduler.schedule(collection.name, [event.cacheKey])
          }
        }

        // Advance known revision
        this.knownRevisions.set(event.streamId, event.revision)
      }
    }
  }
}
