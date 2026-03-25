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
import type { IPersistedEvent, Link } from '@meticoeus/ddd-es'
import { logProvider } from '@meticoeus/ddd-es'
import { Subject, Subscription, takeUntil } from 'rxjs'
import type { Collection, FetchContext, NetworkConfig } from '../../types/config.js'
import { hydrateSerializedEvent, normalizeEventPersistence } from '../../types/events.js'
import type { AuthStrategy } from '../auth.js'
import type { CacheManager } from '../cache-manager/CacheManager.js'
import type { IAnticipatedEvent } from '../command-lifecycle/AnticipatedEventShape.js'
import type { CommandQueue } from '../command-queue/CommandQueue.js'
import type { EventCache } from '../event-cache/EventCache.js'
import type { EventProcessorRunner, ParsedEvent } from '../event-processor/index.js'
import type { EventBus } from '../events/EventBus.js'
import type { QueryManager } from '../query-manager/QueryManager.js'
import type { ReadModelStore } from '../read-model-store/ReadModelStore.js'
import type { SessionManager } from '../session/SessionManager.js'
import { ConnectivityManager } from './ConnectivityManager.js'

/**
 * Sync manager configuration.
 */
export interface SyncManagerConfig<TLink extends Link, TSchema, TEvent extends IAnticipatedEvent> {
  eventBus: EventBus
  sessionManager: SessionManager
  commandQueue: CommandQueue<TLink, TSchema, TEvent>
  eventCache: EventCache
  cacheManager: CacheManager<TLink>
  eventProcessor: EventProcessorRunner
  readModelStore: ReadModelStore
  queryManager: QueryManager<TLink>
  networkConfig: NetworkConfig
  auth: AuthStrategy
  collections: Collection<TLink>[]
}

/**
 * Sync status for a collection.
 */
export interface CollectionSyncStatus {
  collection: string
  seeded: boolean
  lastSyncedPosition?: bigint
  syncing: boolean
  error?: string
}

/**
 * Sync manager.
 */
export class SyncManager<TLink extends Link, TSchema, TEvent extends IAnticipatedEvent> {
  private readonly eventBus: EventBus
  private readonly sessionManager: SessionManager
  private readonly commandQueue: CommandQueue<TLink, TSchema, TEvent>
  private readonly eventCache: EventCache
  private readonly cacheManager: CacheManager<TLink>
  private readonly eventProcessor: EventProcessorRunner
  private readonly readModelStore: ReadModelStore
  private readonly queryManager: QueryManager<TLink>
  private readonly networkConfig: NetworkConfig
  private readonly auth: AuthStrategy
  private readonly collections: Collection<TLink>[]

  private readonly connectivity: ConnectivityManager

  /** Mutable — recreated on each start() so takeUntil subscriptions work after stop()/start() cycles. */
  private destroy$ = new Subject<void>()

  private readonly collectionStatus = new Map<string, CollectionSyncStatus>()
  private readonly repairing = new Set<string>()
  private wsConnection: WebSocket | undefined
  private subscriptions: Subscription[] = []
  private abortController: AbortController | undefined

  /** Queue for serializing WebSocket event processing. */
  private readonly wsEventQueue: IPersistedEvent[] = []
  private processingWsEvents = false
  private wsProcessingPromise: Promise<void> | undefined

  /** Single-flight guard for startSync — prevents overlapping syncs and captures rejections. */
  private startSyncPromise: Promise<void> | undefined

  /** Highest applied revision per stream. Initialized during seeding, advanced on happy-path processing. */
  private readonly knownRevisions = new Map<string, bigint>()

  /** Debounced collection refetch timers for invalidation responses. */
  private readonly pendingRefetches = new Map<string, ReturnType<typeof setTimeout>>()

  /** True while setAuthenticated/setUnauthenticated is handling the wipe inline. */
  private sessionDestroyHandledInline = false

  private static readonly INVALIDATION_REFETCH_DELAY_MS = 500

  constructor(config: SyncManagerConfig<TLink, TSchema, TEvent>) {
    this.eventBus = config.eventBus
    this.sessionManager = config.sessionManager
    this.commandQueue = config.commandQueue
    this.eventCache = config.eventCache
    this.cacheManager = config.cacheManager
    this.eventProcessor = config.eventProcessor
    this.readModelStore = config.readModelStore
    this.queryManager = config.queryManager
    this.networkConfig = config.networkConfig
    this.auth = config.auth
    this.collections = config.collections

    // Initialize connectivity manager
    this.connectivity = new ConnectivityManager({
      eventBus: this.eventBus,
      healthCheckUrl: `${this.networkConfig.baseUrl}/health`,
    })

    // Initialize collection status
    for (const collection of this.collections) {
      this.collectionStatus.set(collection.name, {
        collection: collection.name,
        seeded: false,
        syncing: false,
      })
    }
  }

  /**
   * Start the sync manager.
   * Begins connectivity monitoring and initial sync.
   *
   * Offline-first startup contract: SessionManager.initialize() sets networkPaused=true,
   * so start() will not trigger sync until the consumer calls setAuthenticated().
   * This allows the app to render immediately from cached data while auth resolves.
   */
  async start(): Promise<void> {
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
  async stop(): Promise<void> {
    this.destroy$.next()
    this.destroy$.complete()

    for (const sub of this.subscriptions) {
      sub.unsubscribe()
    }
    this.subscriptions = []

    // Abort in-flight fetches
    this.abortController?.abort()
    this.abortController = undefined

    // Clear pending WS events
    this.wsEventQueue.length = 0

    // Cancel pending invalidation refetches
    for (const timer of this.pendingRefetches.values()) clearTimeout(timer)
    this.pendingRefetches.clear()

    this.disconnectWebSocket()
    this.connectivity.stop()

    // Wait for in-flight async operations to settle.
    // allSettled because aborted fetches may reject — we want to wait for
    // settlement, not propagate errors that are already handled internally.
    const pending = [this.startSyncPromise, this.wsProcessingPromise].filter(Boolean)
    if (pending.length > 0) {
      await Promise.allSettled(pending)
    }
  }

  /**
   * Permanently destroy the sync manager. Not reversible.
   * Calls stop(), then destroys the connectivity manager.
   */
  async destroy(): Promise<void> {
    await this.stop()
    this.connectivity.destroy()
  }

  /**
   * Get connectivity manager.
   */
  getConnectivity(): ConnectivityManager {
    return this.connectivity
  }

  /**
   * Get sync status for a collection.
   */
  getCollectionStatus(collection: string): CollectionSyncStatus | undefined {
    return this.collectionStatus.get(collection)
  }

  /**
   * Get all collection statuses.
   */
  getAllStatus(): CollectionSyncStatus[] {
    return Array.from(this.collectionStatus.values())
  }

  /**
   * Force sync a specific collection.
   */
  async syncCollection(collection: string): Promise<void> {
    const config = this.collections.find((c) => c.name === collection)
    if (!config) {
      throw new Error(`Unknown collection: ${collection}`)
    }

    await this.seedCollection(config)
  }

  /**
   * Signal that the user has been authenticated.
   * Delegates to SessionManager and returns whether the session was resumed.
   *
   * When the userId differs from the cached session, the data wipe is awaited
   * inline before SessionManager creates the new session.  This prevents the
   * fire-and-forget event subscription from racing with the new session's sync.
   */
  async setAuthenticated(params: { userId: string }): Promise<{ resumed: boolean }> {
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
  async setUnauthenticated(): Promise<void> {
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
  private async onSessionDestroyed(): Promise<void> {
    logProvider.log.debug('Session destroyed, cleaning up sync state')

    // 1. Disconnect WebSocket
    this.disconnectWebSocket()

    // 2. Abort in-flight fetches and create a fresh AbortController for the next session
    this.abortController?.abort()
    this.abortController = new AbortController()

    // 3. Clear pending WS events
    this.wsEventQueue.length = 0

    // 4. Clear revision tracking
    this.knownRevisions.clear()

    // 5. Cancel pending invalidation refetches
    for (const timer of this.pendingRefetches.values()) clearTimeout(timer)
    this.pendingRefetches.clear()

    // 6. Clear all commands — pauses, clears retry timers, waits for in-flight, deletes commands
    await this.commandQueue.clearAll()

    // 7. Cascade-delete all cache keys, events, and read models from storage + clear in-memory state
    await this.cacheManager.onSessionDestroyed()

    // 8. Clear gap buffer and cacheKeyStreams index
    this.eventCache.clearGapBuffer()

    // 9. Clear query manager holds (without calling cacheManager — already wiped)
    this.queryManager.onSessionDestroyed()

    // 10. Reset all collection statuses
    for (const collection of this.collections) {
      this.collectionStatus.set(collection.name, {
        collection: collection.name,
        seeded: false,
        syncing: false,
      })
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
    await this.restoreKnownRevisions()

    // Resume command processing
    this.commandQueue.resume()

    // Seed collections that have a seedCacheKey and fetch methods
    // TODO(lazy-load): seedCacheKey collections always seed on startup. Lazily-loaded
    // collections need consumer-driven seeding. On restart, consult stored cache keys
    // in the DB to determine what to re-seed and in what order (spec §2.3).
    for (const collection of this.collections) {
      const status = this.collectionStatus.get(collection.name)
      const canSeed = collection.fetchSeedRecords || collection.fetchSeedEvents
      if (status && !status.seeded && collection.seedCacheKey && canSeed) {
        await this.seedCollection(collection)
      }
    }

    // Connect WebSocket for real-time updates
    this.connectWebSocket()

    // Process pending commands
    await this.commandQueue.processPendingCommands()
  }

  /**
   * Seed a collection from the server.
   *
   * @param collection - Collection configuration
   * @param reason - Why this seed is happening ('initial' for first sync, 'refetch' for invalidation)
   */
  private async seedCollection(
    collection: Collection<TLink>,
    reason: 'initial' | 'refetch' = 'initial',
  ): Promise<void> {
    if (!collection.fetchSeedRecords && !collection.fetchSeedEvents) return
    if (!collection.seedCacheKey) return

    const status = this.collectionStatus.get(collection.name)
    if (!status || status.syncing) return

    this.updateCollectionStatus(collection.name, { syncing: true, error: undefined })
    this.eventBus.emit('sync:started', { collection: collection.name })

    try {
      const cacheKey = await this.cacheManager.acquire(collection.seedCacheKey)
      const ctx = await this.buildFetchContext()
      const pageSize = collection.seedPageSize ?? 100
      let recordCount = 0

      if (collection.fetchSeedRecords) {
        recordCount = await this.seedWithRecords(collection, ctx, cacheKey, pageSize)
      } else if (collection.fetchSeedEvents) {
        recordCount = await this.seedWithEvents(collection, ctx, cacheKey, pageSize)
      }

      this.updateCollectionStatus(collection.name, {
        seeded: true,
        syncing: false,
      })

      logProvider.log.debug({ collection: collection.name }, 'Collection sync completed')
      this.eventBus.emit('sync:completed', { collection: collection.name, eventCount: 0 })

      if (reason === 'refetch') {
        this.eventBus.emitDebug('sync:refetch-executed', {
          collection: collection.name,
          recordCount,
        })
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logProvider.log.error({ collection: collection.name, err: error }, 'Collection sync failed')
      this.updateCollectionStatus(collection.name, {
        syncing: false,
        error: errorMessage,
      })

      this.eventBus.emit('sync:failed', { collection: collection.name, error: errorMessage })
    }
  }

  /**
   * Seed a collection using pre-computed read model records.
   *
   * @returns Total number of records seeded
   */
  private async seedWithRecords(
    collection: Collection<TLink>,
    ctx: FetchContext,
    cacheKey: string,
    pageSize: number,
  ): Promise<number> {
    let cursor: string | null = null
    let totalRecords = 0

    do {
      const page = await collection.fetchSeedRecords!({ ctx, cursor, limit: pageSize })
      this.connectivity.reportContact()

      if (page.records.length > 0) {
        for (const record of page.records) {
          const revisionMeta = record.revision
            ? { revision: record.revision, position: record.position }
            : undefined
          await this.readModelStore.setServerData(
            collection.name,
            record.id,
            record.data,
            cacheKey,
            revisionMeta,
          )

          // Populate knownRevisions for gap detection during WS processing
          if (record.revision && collection.getStreamId) {
            const streamId = collection.getStreamId(record.id)
            const revBigint = BigInt(record.revision)
            const current = this.knownRevisions.get(streamId)
            if (current === undefined || revBigint > current) {
              this.knownRevisions.set(streamId, revBigint)
            }
          }
        }
        totalRecords += page.records.length
      }

      if (page.records.length < pageSize) break
      cursor = page.nextCursor
    } while (cursor)

    // Notify reactive queries that the collection has new data.
    // Unlike seedWithEvents (where EventProcessorRunner emits per-event),
    // record-based seeding writes directly to storage, so a single bulk
    // notification is needed after all pages are loaded.
    if (totalRecords > 0) {
      this.eventBus.emit('readmodel:updated', { collection: collection.name, ids: [] })
    }

    this.eventBus.emit('sync:seed-completed', {
      collection: collection.name,
      cacheKey,
      recordCount: totalRecords,
    })

    return totalRecords
  }

  /**
   * Seed a collection using events processed through event processors.
   *
   * @returns Total number of events seeded
   */
  private async seedWithEvents(
    collection: Collection<TLink>,
    ctx: FetchContext,
    cacheKey: string,
    pageSize: number,
  ): Promise<number> {
    let cursor: string | null = null
    let eventCount = 0

    do {
      const page = await collection.fetchSeedEvents!({ ctx, cursor, limit: pageSize })
      this.connectivity.reportContact()

      if (page.events.length > 0) {
        // Cache events
        await this.eventCache.cacheServerEvents(page.events, { cacheKey })

        // Process events
        const parsedEvents = page.events.map((e) => this.toParsedEvent(e, cacheKey))
        await this.eventProcessor.processEvents(parsedEvents)

        // Track highest revision per stream for gap detection during WS processing
        for (const event of page.events) {
          const persistence = normalizeEventPersistence(event)
          if (persistence === 'Permanent') {
            const current = this.knownRevisions.get(event.streamId)
            if (current === undefined || event.revision > current) {
              this.knownRevisions.set(event.streamId, event.revision)
            }
          }
        }

        eventCount += page.events.length
      }

      if (page.events.length < pageSize) break
      cursor = page.nextCursor
    } while (cursor)

    logProvider.log.debug({ collection: collection.name, eventCount }, 'Event-based seed completed')

    this.eventBus.emit('sync:seed-completed', {
      collection: collection.name,
      cacheKey,
      recordCount: eventCount,
    })

    return eventCount
  }

  /**
   * Build network context for collection fetch methods.
   * Merges static headers from NetworkConfig with dynamic auth headers
   * from the AuthStrategy. For cookie-based auth, this is a no-op —
   * the browser sends cookies automatically with fetch().
   */
  private async buildFetchContext(): Promise<FetchContext> {
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
                this.sendSubscriptions()
                break
              case 'event':
                this.enqueueWsEvent(hydrateSerializedEvent(message.event))
                break
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
   * Send topic subscriptions after receiving the connected message.
   * Collects topics from all collections via getTopics(), deduplicates with a Set.
   */
  private sendSubscriptions(): void {
    if (!this.wsConnection) return
    const topicSet = new Set<string>()
    for (const collection of this.collections) {
      for (const topic of collection.getTopics()) {
        topicSet.add(topic)
      }
    }
    const topics = Array.from(topicSet)
    if (topics.length === 0) return
    this.wsConnection.send(serializeClientMessage({ type: 'subscribe', topics }))
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
   * Enqueue a WebSocket event for serialized processing.
   * Events are processed one at a time to prevent concurrent gap repairs
   * from interleaving and missing buffered events.
   */
  private enqueueWsEvent(event: IPersistedEvent): void {
    this.wsEventQueue.push(event)
    if (!this.processingWsEvents) {
      this.wsProcessingPromise = this.processWsEventQueue()
    }
  }

  /**
   * Drain the WebSocket event queue, processing events one at a time.
   */
  private async processWsEventQueue(): Promise<void> {
    this.processingWsEvents = true
    try {
      let event: IPersistedEvent | undefined
      while ((event = this.wsEventQueue.shift())) {
        try {
          await this.handleWebSocketEvent(event)
        } catch (error) {
          logProvider.log.error(
            { err: error, eventId: event.id },
            'Failed to handle WebSocket event',
          )
        }
      }
    } finally {
      this.processingWsEvents = false
      this.wsProcessingPromise = undefined
    }
  }

  /**
   * Handle a WebSocket event.
   * Per-stream gap detection: check AFTER caching, repair inline when gaps exist.
   */
  private async handleWebSocketEvent(event: IPersistedEvent): Promise<void> {
    const matchingCollections = this.getMatchingCollections(event.streamId)
    const [primaryCollection] = matchingCollections
    if (!primaryCollection) return

    this.eventBus.emitDebug('sync:ws-event-received', { event })

    // TODO(lazy-load): WS events for lazily-loaded collections need to look up
    // active cache keys by collection instead of relying on a static seedCacheKey.
    if (!primaryCollection.seedCacheKey) return
    const cacheKey = await this.cacheManager.acquire(primaryCollection.seedCacheKey)

    const cached = await this.eventCache.cacheServerEvent(event, { cacheKey })
    if (!cached) return // Duplicate

    const persistence = normalizeEventPersistence(event)

    // Stateful events skip revision checks — applied best-effort and processed immediately (spec §4.7)
    if (persistence === 'Stateful') {
      const parsed = this.toParsedEvent(event, cacheKey)
      const result = await this.eventProcessor.processEvent(parsed)

      this.eventBus.emitDebug('sync:ws-event-processed', {
        event,
        updatedIds: result.updatedIds,
        invalidated: result.invalidated,
      })

      if (result.invalidated) {
        for (const collection of matchingCollections) {
          this.scheduleCollectionRefetch(collection.name)
        }
      }

      for (const collection of matchingCollections) {
        this.updateCollectionStatus(collection.name, {
          lastSyncedPosition: event.position,
        })
      }
      return
    }

    // Permanent events: check revision ordering.
    // Default -1n represents "no stream" — the state before the first event (revision 0).
    const expectedRevision = (this.knownRevisions.get(event.streamId) ?? -1n) + 1n

    if (event.revision !== expectedRevision) {
      this.eventBus.emitDebug('sync:gap-detected', {
        streamId: event.streamId,
        expected: expectedRevision,
        received: event.revision,
      })

      // Gap or out-of-order — event is already in GapBuffer from caching, trigger repair
      if (!this.repairing.has(event.streamId)) {
        await this.repairStreamGap(event.streamId, primaryCollection.name, cacheKey)
      }
      return
    }

    // Happy path — expected revision, process immediately
    const parsed = this.toParsedEvent(event, cacheKey)
    const result = await this.eventProcessor.processEvent(parsed)

    this.eventBus.emitDebug('sync:ws-event-processed', {
      event,
      updatedIds: result.updatedIds,
      invalidated: result.invalidated,
    })

    // Advance known revision
    this.knownRevisions.set(event.streamId, event.revision)

    // Clear this event from gap buffer and advance known position
    this.eventCache.clearGapBuffer(event.streamId, event.revision)
    this.eventCache.setKnownPosition(event.streamId, event.revision)

    if (result.invalidated) {
      for (const collection of matchingCollections) {
        this.scheduleCollectionRefetch(collection.name)
      }
    }

    for (const collection of matchingCollections) {
      this.updateCollectionStatus(collection.name, {
        lastSyncedPosition: event.position,
      })
    }
  }

  /**
   * Repair a gap in a specific stream by fetching missing events from the server.
   */
  private async repairStreamGap(
    streamId: string,
    collectionName: string,
    cacheKey: string,
  ): Promise<void> {
    this.repairing.add(streamId)

    const gaps = this.eventCache.getStreamGaps(streamId)
    const firstGap = gaps[0]
    const fromRevision = firstGap?.fromPosition ?? -1n

    this.eventBus.emitDebug('sync:gap-repair-started', { streamId, fromRevision })

    try {
      const collection = this.collections.find((c) => c.name === collectionName)
      if (!collection?.fetchStreamEvents) {
        // No fetch method — process buffered events as-is (lossy but unblocked)
        await this.processBufferedEventsForStream(streamId, cacheKey)
        this.eventBus.emitDebug('sync:gap-repair-completed', {
          streamId,
          eventCount: 0,
        })
        return
      }

      if (!firstGap) {
        this.eventBus.emitDebug('sync:gap-repair-completed', {
          streamId,
          eventCount: 0,
        })
        return
      }

      // Fetch events after the last known good revision (exclusive)
      const ctx = await this.buildFetchContext()
      const events = await collection.fetchStreamEvents({
        ctx,
        streamId,
        afterRevision: firstGap.fromPosition,
      })
      this.connectivity.reportContact()

      // Cache fetched events (fills the gap; duplicates are rejected by EventCache)
      for (const evt of events) {
        await this.eventCache.cacheServerEvent(evt, { cacheKey })
      }

      // Process all buffered events for this stream in revision order
      await this.processBufferedEventsForStream(streamId, cacheKey)

      this.eventBus.emitDebug('sync:gap-repair-completed', {
        streamId,
        eventCount: events.length,
      })
    } catch (error) {
      logProvider.log.error({ streamId, err: error }, 'Gap repair failed')
      // Events stay buffered — next WS event for this stream will retry
    } finally {
      this.repairing.delete(streamId)
    }
  }

  /**
   * Process all buffered events for a stream in revision order.
   */
  private async processBufferedEventsForStream(streamId: string, cacheKey: string): Promise<void> {
    const buffered = this.eventCache.getBufferedEvents(streamId)
    let anyInvalidated = false

    for (const entry of buffered) {
      const parsed = this.toParsedEvent(entry.event, cacheKey)
      const result = await this.eventProcessor.processEvent(parsed)
      if (result.invalidated) {
        anyInvalidated = true
      }
    }

    const last = buffered[buffered.length - 1]
    if (last) {
      this.eventCache.clearGapBuffer(streamId, last.position)
      this.eventCache.setKnownPosition(streamId, last.position)

      // Update known revision from the last buffered event's revision
      this.knownRevisions.set(streamId, last.event.revision)
    }

    if (anyInvalidated) {
      const matchingCollections = this.getMatchingCollections(streamId)
      for (const collection of matchingCollections) {
        this.scheduleCollectionRefetch(collection.name)
      }
    }
  }

  /**
   * Convert persisted event to parsed event for processor.
   */
  private toParsedEvent(event: IPersistedEvent, cacheKey: string): ParsedEvent {
    const persistence = normalizeEventPersistence(event)
    const commandId = this.extractCommandId(event)
    return {
      id: event.id,
      type: event.type,
      streamId: event.streamId,
      persistence,
      data: event.data,
      commandId,
      revision: event.revision,
      position: event.position,
      cacheKey,
    }
  }

  /**
   * Extract commandId from event metadata (server contract: metadata.commandId).
   */
  private extractCommandId(event: IPersistedEvent): string | undefined {
    const metadata = event.metadata
    if (typeof metadata !== 'object' || metadata === null) return undefined
    if ('commandId' in metadata && typeof metadata.commandId === 'string') {
      return metadata.commandId
    }
    return undefined
  }

  /**
   * Schedule a debounced refetch for a collection after an invalidation signal.
   * Repeated invalidations within the delay window are coalesced into a single refetch.
   */
  // TODO(lazy-load): For lazily-loaded data, refetch needs to know which active
  // cache key(s) are associated with the collection, not just use seedCacheKey.
  private scheduleCollectionRefetch(collectionName: string): void {
    const existing = this.pendingRefetches.get(collectionName)
    if (existing !== undefined) clearTimeout(existing)

    this.eventBus.emitDebug('sync:refetch-scheduled', {
      collection: collectionName,
      debounceMs: SyncManager.INVALIDATION_REFETCH_DELAY_MS,
    })

    const timer = setTimeout(() => {
      this.pendingRefetches.delete(collectionName)
      const config = this.collections.find((c) => c.name === collectionName)
      if (config) {
        this.seedCollection(config, 'refetch').catch((err) => {
          logProvider.log.error({ err, collection: collectionName }, 'Invalidation refetch failed')
        })
      }
    }, SyncManager.INVALIDATION_REFETCH_DELAY_MS)

    this.pendingRefetches.set(collectionName, timer)
  }

  /**
   * Restore known revisions from persisted read model tables.
   * Called before WS connects to prevent false-positive gap detection after page reload.
   */
  private async restoreKnownRevisions(): Promise<void> {
    for (const collection of this.collections) {
      if (!collection.getStreamId) continue
      const entries = await this.readModelStore.getRevisionMap(collection.name)
      for (const entry of entries) {
        const streamId = collection.getStreamId(entry.id)
        const revBigint = BigInt(entry.revision)
        const current = this.knownRevisions.get(streamId)
        if (current === undefined || revBigint > current) {
          this.knownRevisions.set(streamId, revBigint)
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
            this.scheduleCollectionRefetch(collection.name)
          }
        }

        // Advance known revision
        this.knownRevisions.set(event.streamId, event.revision)
      }
    }
  }

  /**
   * Update collection status.
   */
  private updateCollectionStatus(collection: string, updates: Partial<CollectionSyncStatus>): void {
    const current = this.collectionStatus.get(collection)
    if (current) {
      this.collectionStatus.set(collection, { ...current, ...updates })
    }
  }
}
