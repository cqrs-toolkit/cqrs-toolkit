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
import type { IPersistedEvent } from '@meticoeus/ddd-es'
import { logProvider } from '@meticoeus/ddd-es'
import { Subject, Subscription, takeUntil } from 'rxjs'
import type { Collection, FetchContext, NetworkConfig } from '../../types/config.js'
import { hydrateSerializedEvent, normalizeEventPersistence } from '../../types/events.js'
import type { CacheManager } from '../cache-manager/CacheManager.js'
import type { CommandQueue } from '../command-queue/CommandQueue.js'
import type { EventCache } from '../event-cache/EventCache.js'
import type { EventProcessorRunner, ParsedEvent } from '../event-processor/index.js'
import type { EventBus } from '../events/EventBus.js'
import type { ReadModelStore } from '../read-model-store/ReadModelStore.js'
import type { SessionManager } from '../session/SessionManager.js'
import { ConnectivityManager } from './ConnectivityManager.js'

/**
 * Sync manager configuration.
 */
export interface SyncManagerConfig {
  eventBus: EventBus
  sessionManager: SessionManager
  commandQueue: CommandQueue
  eventCache: EventCache
  cacheManager: CacheManager
  eventProcessor: EventProcessorRunner
  readModelStore: ReadModelStore
  networkConfig: NetworkConfig
  collections: Collection[]
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
export class SyncManager {
  private readonly eventBus: EventBus
  private readonly sessionManager: SessionManager
  private readonly commandQueue: CommandQueue
  private readonly eventCache: EventCache
  private readonly cacheManager: CacheManager
  private readonly eventProcessor: EventProcessorRunner
  private readonly readModelStore: ReadModelStore
  private readonly networkConfig: NetworkConfig
  private readonly collections: Collection[]

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

  /** Single-flight guard for startSync — prevents overlapping syncs and captures rejections. */
  private startSyncPromise: Promise<void> | undefined

  constructor(config: SyncManagerConfig) {
    this.eventBus = config.eventBus
    this.sessionManager = config.sessionManager
    this.commandQueue = config.commandQueue
    this.eventCache = config.eventCache
    this.cacheManager = config.cacheManager
    this.eventProcessor = config.eventProcessor
    this.readModelStore = config.readModelStore
    this.networkConfig = config.networkConfig
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

    // Subscribe to session destroyed — clean up sync state on logout
    const destroyedSub = this.eventBus
      .on('session:destroyed')
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.onSessionDestroyed()
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
  stop(): void {
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

    this.disconnectWebSocket()
    this.connectivity.stop()
  }

  /**
   * Permanently destroy the sync manager. Not reversible.
   * Calls stop(), then destroys the connectivity manager.
   */
  destroy(): void {
    this.stop()
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
  private onSessionDestroyed(): void {
    logProvider.log.debug('Session destroyed, cleaning up sync state')

    // Disconnect WebSocket
    this.disconnectWebSocket()

    // Abort in-flight fetches and create a fresh AbortController for the next session
    this.abortController?.abort()
    this.abortController = new AbortController()

    // Clear pending WS events
    this.wsEventQueue.length = 0

    // Pause command queue
    this.commandQueue.pause()

    // Reset all collection statuses
    for (const collection of this.collections) {
      this.collectionStatus.set(collection.name, {
        collection: collection.name,
        seeded: false,
        syncing: false,
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

    // Resume command processing
    this.commandQueue.resume()

    // Seed collections that need it
    for (const collection of this.collections) {
      const status = this.collectionStatus.get(collection.name)
      const canSeed = collection.fetchSeedRecords || collection.fetchSeedEvents
      if (status && !status.seeded && collection.seedOnInit !== false && canSeed) {
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
   */
  private async seedCollection(collection: Collection): Promise<void> {
    if (!collection.fetchSeedRecords && !collection.fetchSeedEvents) return

    const status = this.collectionStatus.get(collection.name)
    if (!status || status.syncing) return

    this.updateCollectionStatus(collection.name, { syncing: true, error: undefined })
    this.eventBus.emit('sync:started', { collection: collection.name })

    try {
      const cacheKey = await this.cacheManager.acquire(collection.name)
      const ctx = await this.buildFetchContext()
      const pageSize = collection.seedPageSize ?? 100

      if (collection.fetchSeedRecords) {
        await this.seedWithRecords(collection, ctx, cacheKey, pageSize)
      } else if (collection.fetchSeedEvents) {
        await this.seedWithEvents(collection, ctx, cacheKey, pageSize)
      }

      this.updateCollectionStatus(collection.name, {
        seeded: true,
        syncing: false,
      })

      logProvider.log.debug({ collection: collection.name }, 'Collection sync completed')
      this.eventBus.emit('sync:completed', { collection: collection.name, eventCount: 0 })
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
   */
  private async seedWithRecords(
    collection: Collection,
    ctx: FetchContext,
    cacheKey: string,
    pageSize: number,
  ): Promise<void> {
    let cursor: string | null = null

    do {
      const page = await collection.fetchSeedRecords!(ctx, cursor, pageSize)
      this.connectivity.reportContact()

      if (page.records.length > 0) {
        for (const record of page.records) {
          await this.readModelStore.setServerData(collection.name, record.id, record.data, cacheKey)
        }
      }

      cursor = page.nextCursor
    } while (cursor)
  }

  /**
   * Seed a collection using events processed through event processors.
   */
  private async seedWithEvents(
    collection: Collection,
    ctx: FetchContext,
    cacheKey: string,
    pageSize: number,
  ): Promise<void> {
    let cursor: string | null = null
    let eventCount = 0

    do {
      const page = await collection.fetchSeedEvents!(ctx, cursor, pageSize)
      this.connectivity.reportContact()

      if (page.events.length > 0) {
        // Cache events
        await this.eventCache.cacheServerEvents(page.events, { cacheKey })

        // Process events
        const parsedEvents = page.events.map((e) => this.toParsedEvent(e, cacheKey))
        await this.eventProcessor.processEvents(parsedEvents)

        eventCount += page.events.length
      }

      cursor = page.nextCursor
    } while (cursor)

    logProvider.log.debug({ collection: collection.name, eventCount }, 'Event-based seed completed')
  }

  /**
   * Build network context for collection fetch methods.
   * Resolves headers from NetworkConfig. If getAuthToken is configured (Bearer token apps),
   * the resolved token is included. For cookie-based auth, this is a no-op —
   * the browser sends cookies automatically with fetch().
   */
  private async buildFetchContext(): Promise<FetchContext> {
    const headers: Record<string, string> = { ...this.networkConfig.headers }
    if (this.networkConfig.getAuthToken) {
      const token = await this.networkConfig.getAuthToken()
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
    }
    const signal = this.abortController?.signal ?? AbortSignal.abort()
    return { baseUrl: this.networkConfig.baseUrl, headers, signal }
  }

  /**
   * Find all collections that match a given streamId.
   */
  private getMatchingCollections(streamId: string): Collection[] {
    return this.collections.filter((c) => c.matchesStream(streamId))
  }

  /**
   * Connect WebSocket for real-time events.
   */
  private connectWebSocket(): void {
    if (!this.networkConfig.wsUrl || this.wsConnection) return

    try {
      this.wsConnection = new WebSocket(this.networkConfig.wsUrl)

      this.wsConnection.onopen = () => {
        logProvider.log.debug('WebSocket connected')
        this.connectivity.reportContact()
      }

      this.wsConnection.onmessage = (wsEvent) => {
        try {
          const message = parseServerMessage(wsEvent.data)
          if (!message) return

          switch (message.type) {
            case 'connected':
              logProvider.log.debug('WebSocket server ack')
              this.sendSubscriptions()
              break
            case 'event':
              this.enqueueWsEvent(hydrateSerializedEvent(message.event))
              break
            case 'heartbeat':
              this.connectivity.reportContact()
              break
            case 'subscribed':
            case 'unsubscribed':
              logProvider.log.debug(
                { type: message.type, topics: message.topics },
                'Subscription update',
              )
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

      this.wsConnection.onclose = () => {
        logProvider.log.debug('WebSocket disconnected')
        this.wsConnection = undefined
        // Reconnect if still online
        if (this.connectivity.isOnline()) {
          setTimeout(() => this.connectWebSocket(), 5000)
        }
      }

      this.wsConnection.onerror = () => {
        this.connectivity.reportFailure()
      }
    } catch (error) {
      logProvider.log.error({ err: error }, 'Failed to connect WebSocket')
    }
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
      this.processWsEventQueue()
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
    }
  }

  /**
   * Handle a WebSocket event.
   * Per-stream gap detection: check AFTER caching, repair inline when gaps exist.
   */
  private async handleWebSocketEvent(event: IPersistedEvent): Promise<void> {
    const matchingCollections = this.getMatchingCollections(event.streamId)
    const [primaryCollection, ...rest] = matchingCollections
    if (!primaryCollection) return

    const cacheKey = await this.cacheManager.acquire(primaryCollection.name)

    const cached = await this.eventCache.cacheServerEvent(event, { cacheKey })
    if (!cached) return // Duplicate

    const gaps = this.eventCache.getStreamGaps(event.streamId)
    if (gaps.length > 0) {
      // Gap detected — repair if not already repairing this stream
      if (!this.repairing.has(event.streamId)) {
        await this.repairStreamGap(event.streamId, primaryCollection.name, cacheKey)
      }
      // Either repair processed this event, or it's buffered for an in-progress repair
      return
    }

    // Happy path — no gaps, process immediately
    const parsed = this.toParsedEvent(event, cacheKey)
    await this.eventProcessor.processEvent(parsed)

    // Clear this event from gap buffer and advance known revision
    this.eventCache.clearGapBuffer(event.streamId, event.revision)
    this.eventCache.setKnownPosition(event.streamId, event.revision)

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
    try {
      const collection = this.collections.find((c) => c.name === collectionName)
      if (!collection?.fetchStreamEvents) {
        // No fetch method — process buffered events as-is (lossy but unblocked)
        await this.processBufferedEventsForStream(streamId, cacheKey)
        return
      }

      const gaps = this.eventCache.getStreamGaps(streamId)
      const firstGap = gaps[0]
      if (!firstGap) return

      // Fetch events after the last known good revision (exclusive)
      const ctx = await this.buildFetchContext()
      const events = await collection.fetchStreamEvents(ctx, streamId, firstGap.fromPosition)
      this.connectivity.reportContact()

      // Cache fetched events (fills the gap; duplicates are rejected by EventCache)
      for (const evt of events) {
        await this.eventCache.cacheServerEvent(evt, { cacheKey })
      }

      // Process all buffered events for this stream in revision order
      await this.processBufferedEventsForStream(streamId, cacheKey)
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
    for (const entry of buffered) {
      const parsed = this.toParsedEvent(entry.event, cacheKey)
      await this.eventProcessor.processEvent(parsed)
    }

    const last = buffered[buffered.length - 1]
    if (last) {
      this.eventCache.clearGapBuffer(streamId, last.position)
      this.eventCache.setKnownPosition(streamId, last.position)
    }
  }

  /**
   * Convert persisted event to parsed event for processor.
   */
  private toParsedEvent(event: IPersistedEvent, cacheKey: string): ParsedEvent {
    const persistence = normalizeEventPersistence(event)
    return {
      id: event.id,
      type: event.type,
      streamId: event.streamId,
      persistence,
      data: event.data,
      revision: persistence !== 'Stateful' ? String(event.revision) : undefined,
      cacheKey,
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
