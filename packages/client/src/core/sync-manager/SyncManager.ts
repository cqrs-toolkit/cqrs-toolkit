/**
 * Sync manager orchestrates data synchronization between client and server.
 *
 * Responsibilities:
 * - Coordinate collection seeding
 * - Handle WebSocket event streams
 * - Manage gap repair
 * - Trigger command processing
 */

import type { EventMessage } from '@cqrs-toolkit/realtime'
import { parseServerMessage, serializeClientMessage } from '@cqrs-toolkit/realtime'
import { logProvider } from '@meticoeus/ddd-es'
import { Subject, Subscription, takeUntil } from 'rxjs'
import type { CollectionConfig, NetworkConfig } from '../../types/config.js'
import { isPermanentEvent, type ServerEvent } from '../../types/events.js'
import type { CacheManager } from '../cache-manager/CacheManager.js'
import type { CommandQueue } from '../command-queue/CommandQueue.js'
import type { EventCache } from '../event-cache/EventCache.js'
import type { EventProcessorRunner, ParsedEvent } from '../event-processor/index.js'
import type { EventBus } from '../events/EventBus.js'
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
  networkConfig: NetworkConfig
  collections: CollectionConfig[]
}

/**
 * Sync status for a collection.
 */
export interface CollectionSyncStatus {
  collection: string
  seeded: boolean
  lastSyncedPosition: bigint | null
  syncing: boolean
  error: string | null
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
  private readonly networkConfig: NetworkConfig
  private readonly collections: CollectionConfig[]

  private readonly connectivity: ConnectivityManager
  private readonly destroy$ = new Subject<void>()

  private readonly collectionStatus = new Map<string, CollectionSyncStatus>()
  private readonly streamPrefixToCollection: Map<string, string>
  private readonly repairing = new Set<string>()
  private wsConnection: WebSocket | null = null
  private subscriptions: Subscription[] = []

  constructor(config: SyncManagerConfig) {
    this.eventBus = config.eventBus
    this.sessionManager = config.sessionManager
    this.commandQueue = config.commandQueue
    this.eventCache = config.eventCache
    this.cacheManager = config.cacheManager
    this.eventProcessor = config.eventProcessor
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
        lastSyncedPosition: null,
        syncing: false,
        error: null,
      })
    }

    // Build streamId prefix → collection name lookup from topic patterns.
    // Topic "Note:*" → prefix "Note" → collection "notes".
    // Stream "Note-abc" → prefix "Note" → lookup → "notes".
    this.streamPrefixToCollection = new Map()
    for (const col of this.collections) {
      if (col.topicPattern) {
        const colonIdx = col.topicPattern.indexOf(':')
        if (colonIdx > 0) {
          this.streamPrefixToCollection.set(col.topicPattern.slice(0, colonIdx), col.name)
        }
      }
    }
  }

  /**
   * Start the sync manager.
   * Begins connectivity monitoring and initial sync.
   */
  async start(): Promise<void> {
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
          this.startSync()
        }
      })
    this.subscriptions.push(sessionSub)

    // If already online and authenticated, start sync
    if (this.connectivity.isOnline() && !this.sessionManager.isNetworkPaused()) {
      await this.startSync()
    }
  }

  /**
   * Stop the sync manager.
   */
  stop(): void {
    this.destroy$.next()
    this.destroy$.complete()

    for (const sub of this.subscriptions) {
      sub.unsubscribe()
    }
    this.subscriptions = []

    this.disconnectWebSocket()
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
  getCollectionStatus(collection: string): CollectionSyncStatus | null {
    return this.collectionStatus.get(collection) ?? null
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
      this.startSync()
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
   * Start full sync process.
   */
  private async startSync(): Promise<void> {
    logProvider.log.debug('Starting sync')

    // Resume command processing
    this.commandQueue.resume()

    // Seed collections that need it
    for (const config of this.collections) {
      const status = this.collectionStatus.get(config.name)
      if (status && !status.seeded && config.seedOnInit !== false) {
        await this.seedCollection(config)
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
  private async seedCollection(config: CollectionConfig): Promise<void> {
    const status = this.collectionStatus.get(config.name)
    if (!status || status.syncing) return

    this.updateCollectionStatus(config.name, { syncing: true, error: null })
    this.eventBus.emit('sync:started', { collection: config.name })

    try {
      const cacheKey = await this.cacheManager.acquire(config.name)
      let eventCount = 0
      let cursor: string | null = null
      const pageSize = config.seedPageSize ?? 100

      do {
        const response = await this.fetchEvents(config.name, cursor, pageSize)

        if (response.events.length > 0) {
          // Cache events
          await this.eventCache.cacheServerEvents(response.events, { cacheKey })

          // Process events
          const parsedEvents = response.events.map((e) => this.toParsedEvent(e, cacheKey))
          await this.eventProcessor.processEvents(parsedEvents)

          eventCount += response.events.length
        }

        cursor = response.nextCursor
      } while (cursor)

      this.updateCollectionStatus(config.name, {
        seeded: true,
        syncing: false,
      })

      logProvider.log.debug({ collection: config.name, eventCount }, 'Collection sync completed')
      this.eventBus.emit('sync:completed', { collection: config.name, eventCount })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logProvider.log.error({ collection: config.name, err: error }, 'Collection sync failed')
      this.updateCollectionStatus(config.name, {
        syncing: false,
        error: errorMessage,
      })

      this.eventBus.emit('sync:failed', { collection: config.name, error: errorMessage })
    }
  }

  /**
   * Fetch events from the server.
   */
  private async fetchEvents(
    collection: string,
    cursor: string | null,
    limit: number,
  ): Promise<{ events: ServerEvent[]; nextCursor: string | null }> {
    const url = new URL(`${this.networkConfig.baseUrl}/events/${collection}`)
    if (cursor) {
      url.searchParams.set('cursor', cursor)
    }
    url.searchParams.set('limit', String(limit))

    const headers: Record<string, string> = {
      ...this.networkConfig.headers,
    }

    if (this.networkConfig.getAuthToken) {
      const token = await this.networkConfig.getAuthToken()
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
    }

    const response = await fetch(url.toString(), { headers })

    if (!response.ok) {
      throw new Error(`Failed to fetch events: ${response.status}`)
    }

    this.connectivity.reportContact()

    const data = await response.json()
    const rawEvents: unknown[] = data.events ?? []
    return {
      events: rawEvents.map(hydrateHttpEvent),
      nextCursor: data.nextCursor ?? null,
    }
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

      this.wsConnection.onmessage = async (wsEvent) => {
        try {
          const message = parseServerMessage(wsEvent.data)
          if (!message) return

          switch (message.type) {
            case 'connected':
              logProvider.log.debug('WebSocket server ack')
              this.sendSubscriptions()
              break
            case 'event':
              await this.handleWebSocketEvent(eventMessageToServerEvent(message))
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
        this.wsConnection = null
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
   */
  private sendSubscriptions(): void {
    if (!this.wsConnection) return
    const topics = this.collections
      .map((c) => c.topicPattern)
      .filter((t): t is string => typeof t === 'string')
    if (topics.length === 0) return
    this.wsConnection.send(serializeClientMessage({ type: 'subscribe', topics }))
  }

  /**
   * Disconnect WebSocket.
   */
  private disconnectWebSocket(): void {
    if (this.wsConnection) {
      this.wsConnection.close()
      this.wsConnection = null
    }
  }

  /**
   * Handle a WebSocket event.
   * Per-stream gap detection: check AFTER caching, repair inline when gaps exist.
   */
  private async handleWebSocketEvent(event: ServerEvent): Promise<void> {
    const collection = this.getCollectionFromStream(event.streamId)
    if (!collection) return

    const cacheKey = await this.cacheManager.acquire(collection)

    const cached = await this.eventCache.cacheServerEvent(event, { cacheKey })
    if (!cached) return // Duplicate

    if (isPermanentEvent(event)) {
      const gaps = this.eventCache.getStreamGaps(event.streamId)
      if (gaps.length > 0) {
        // Gap detected — repair if not already repairing this stream
        if (!this.repairing.has(event.streamId)) {
          await this.repairStreamGap(event.streamId, collection, cacheKey)
        }
        // Either repair processed this event, or it's buffered for an in-progress repair
        return
      }
    }

    // Happy path — no gaps, process immediately
    const parsed = this.toParsedEvent(event, cacheKey)
    await this.eventProcessor.processEvent(parsed)

    // Clear this event from gap buffer and advance known revision
    if (isPermanentEvent(event)) {
      this.eventCache.clearGapBuffer(event.streamId, event.revision)
      this.eventCache.setKnownPosition(event.streamId, event.revision)
    }

    this.updateCollectionStatus(collection, {
      lastSyncedPosition: isPermanentEvent(event) ? event.position : undefined,
    })
  }

  /**
   * Repair a gap in a specific stream by fetching missing events from the server.
   */
  private async repairStreamGap(
    streamId: string,
    collection: string,
    cacheKey: string,
  ): Promise<void> {
    this.repairing.add(streamId)
    try {
      const config = this.collections.find((c) => c.name === collection)
      if (!config?.streamEventsEndpoint) {
        // No endpoint configured — process buffered events as-is (lossy but unblocked)
        this.processBufferedEventsForStream(streamId, cacheKey)
        return
      }

      const gaps = this.eventCache.getStreamGaps(streamId)
      const firstGap = gaps[0]
      if (!firstGap) return

      // Fetch events after the last known good revision (exclusive)
      const events = await this.fetchStreamEvents(config, streamId, firstGap.fromPosition)

      // Cache fetched events (fills the gap; duplicates are rejected by EventCache)
      for (const evt of events) {
        await this.eventCache.cacheServerEvent(evt, { cacheKey })
      }

      // Process all buffered events for this stream in revision order
      this.processBufferedEventsForStream(streamId, cacheKey)
    } catch (error) {
      logProvider.log.error({ streamId, err: error }, 'Gap repair failed')
      // Events stay buffered — next WS event for this stream will retry
    } finally {
      this.repairing.delete(streamId)
    }
  }

  /**
   * Fetch per-stream events from the server for gap recovery.
   */
  private async fetchStreamEvents(
    config: CollectionConfig,
    streamId: string,
    afterRevision: bigint,
  ): Promise<ServerEvent[]> {
    const aggregateId = extractAggregateId(streamId)
    const path = config.streamEventsEndpoint!.replace('{id}', aggregateId)
    const url = new URL(`${this.networkConfig.baseUrl}${path}`)

    // TODO: query param name and response shape are hardcoded to match the demo server.
    // These should become configurable when the library supports multiple server conventions.
    url.searchParams.set('afterRevision', String(afterRevision))

    const headers: Record<string, string> = { ...this.networkConfig.headers }
    if (this.networkConfig.getAuthToken) {
      const token = await this.networkConfig.getAuthToken()
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
    }

    const response = await fetch(url.toString(), { headers })
    if (!response.ok) {
      throw new Error(`Gap repair fetch failed: ${response.status}`)
    }

    this.connectivity.reportContact()

    // TODO: response shape `{ events: [...] }` is hardcoded. Make configurable later.
    const data = await response.json()
    const rawEvents: unknown[] = data.events ?? []
    return rawEvents.map(hydrateHttpEvent)
  }

  /**
   * Process all buffered events for a stream in revision order.
   */
  private processBufferedEventsForStream(streamId: string, cacheKey: string): void {
    const buffered = this.eventCache.getBufferedEvents(streamId)
    for (const entry of buffered) {
      const serverEvent = entry.event as ServerEvent
      const parsed = this.toParsedEvent(serverEvent, cacheKey)
      this.eventProcessor.processEvent(parsed)
    }

    const last = buffered[buffered.length - 1]
    if (last) {
      this.eventCache.clearGapBuffer(streamId, last.position)
      this.eventCache.setKnownPosition(streamId, last.position)
    }
  }

  /**
   * Extract collection name from stream ID using topic pattern prefix mapping.
   * Stream "Note-abc" → prefix "Note" → lookup → "notes".
   */
  private getCollectionFromStream(streamId: string): string | null {
    const hyphenIdx = streamId.indexOf('-')
    if (hyphenIdx === -1) return null
    const prefix = streamId.slice(0, hyphenIdx)
    return this.streamPrefixToCollection.get(prefix) ?? null
  }

  /**
   * Convert server event to parsed event for processor.
   */
  private toParsedEvent(event: ServerEvent, cacheKey: string): ParsedEvent {
    return {
      id: event.id,
      type: event.type,
      streamId: event.streamId,
      persistence: event.persistence ?? 'Permanent',
      data: event.data,
      revision: isPermanentEvent(event) ? String(event.revision) : undefined,
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

/**
 * Convert a WebSocket EventMessage (protocol envelope) to the internal ServerEvent type.
 * Reconstructs streamId from aggregateType + topic, converts string fields to bigint.
 */
function eventMessageToServerEvent(message: EventMessage): ServerEvent {
  const { event } = message

  return {
    id: event.id,
    type: event.type,
    streamId: event.streamId,
    data: event.data,
    createdAt: new Date(event.created).getTime(),
    revision: BigInt(event.revision),
    position: BigInt(event.position),
  }
}

// TODO: stream ID format `Type-id` is hardcoded. Make configurable later.
function extractAggregateId(streamId: string): string {
  const hyphenIdx = streamId.indexOf('-')
  return hyphenIdx === -1 ? streamId : streamId.slice(hyphenIdx + 1)
}

/**
 * Hydrate a JSON-parsed HTTP event response into a ServerEvent.
 * HTTP responses include `streamId` alongside SerializedEvent fields.
 */
function hydrateHttpEvent(raw: unknown): ServerEvent {
  const obj = raw as Record<string, unknown>
  return {
    id: obj['id'] as string,
    type: obj['type'] as string,
    streamId: obj['streamId'] as string,
    data: obj['data'],
    createdAt: new Date(obj['created'] as string).getTime(),
    revision: BigInt(obj['revision'] as string),
    position: BigInt(obj['position'] as string),
  }
}
