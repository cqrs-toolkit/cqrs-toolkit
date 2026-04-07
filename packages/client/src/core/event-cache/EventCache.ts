/**
 * Event cache manages cached events (permanent, stateful, anticipated).
 *
 * Responsibilities:
 * - Store events by cache key
 * - Track anticipated events by command
 * - Manage event positions and detect gaps
 * - Support event replacement when server confirms
 */

import { IPersistedEvent, Link, logProvider } from '@meticoeus/ddd-es'
import { Subject } from 'rxjs'
import type { CachedEventRecord, IStorage } from '../../storage/IStorage.js'
import type { AnticipatedEvent } from '../../types/events.js'
import { normalizeEventPersistence } from '../../types/events.js'
import { EnqueueCommand } from '../../types/index.js'
import { generateId } from '../../utils/uuid.js'
import type { ParsedEvent } from '../event-processor/EventProcessorRunner.js'
import type { EventBus } from '../events/EventBus.js'
import { GapBuffer, type EventGap } from './GapDetector.js'

/**
 * Options for caching an event.
 */
export interface CacheEventOptions {
  /** Cache keys to associate with */
  cacheKeys: string[]
  /** For anticipated events, the command ID */
  commandId?: string
}

/**
 * Event cache implementation.
 */
export class EventCache<TLink extends Link, TCommand extends EnqueueCommand> {
  private readonly gapBuffer: GapBuffer<IPersistedEvent>

  /** Index from cache key to the set of streamIds cached under that key. */
  private readonly cacheKeyStreams = new Map<string, Set<string>>()

  /** Lifecycle signal for destroying subscriptions. */
  private readonly destroy$ = new Subject<void>()

  /** Periodic cleanup timer for processed events. */
  private cleanupTimer: ReturnType<typeof setInterval> | undefined

  constructor(
    private readonly storage: IStorage<TLink, TCommand>,
    private readonly eventBus: EventBus<TLink>,
  ) {
    this.gapBuffer = new GapBuffer<IPersistedEvent>()
  }

  /**
   * Cache a persisted event from the server.
   *
   * @param event - Persisted event to cache
   * @param options - Cache options
   * @returns Whether the event was cached (false if duplicate)
   */
  async cacheServerEvent(event: IPersistedEvent, options: CacheEventOptions): Promise<boolean> {
    // Check for duplicate
    const existing = await this.storage.getCachedEvent(event.id)
    if (existing) {
      return false
    }

    const persistence = normalizeEventPersistence(event)
    const record: CachedEventRecord = {
      id: event.id,
      type: event.type,
      streamId: event.streamId,
      persistence,
      data: JSON.stringify(event.data),
      position: event.position.toString(),
      revision: event.revision.toString(),
      commandId: null,
      cacheKeys: options.cacheKeys,
      createdAt: new Date(event.created).getTime(),
      processedAt: null,
    }

    await this.storage.saveCachedEvent(record)

    // Track cacheKey → streamId index
    for (const cacheKey of options.cacheKeys) {
      this.trackCacheKeyStream(cacheKey, event.streamId)
    }

    // Track for gap detection (use revision, not position — revision is per-stream sequential)
    if (persistence === 'Permanent') {
      this.gapBuffer.add(event.streamId, event.revision, event)
    }

    return true
  }

  /**
   * Cache multiple persisted events in batch.
   *
   * Duplicates are silently ignored by the storage layer (INSERT OR IGNORE).
   *
   * @param events - Events to cache
   * @param options - Cache options
   * @returns Number of events submitted (duplicates are silently skipped by storage)
   */
  async cacheServerEvents(events: IPersistedEvent[], options: CacheEventOptions): Promise<number> {
    if (events.length === 0) return 0

    const records: CachedEventRecord[] = events.map((event) => ({
      id: event.id,
      type: event.type,
      streamId: event.streamId,
      persistence: normalizeEventPersistence(event),
      data: JSON.stringify(event.data),
      position: event.position.toString(),
      revision: event.revision.toString(),
      commandId: null,
      cacheKeys: options.cacheKeys,
      createdAt: new Date(event.created).getTime(),
      processedAt: null,
    }))

    await this.storage.saveCachedEvents(records)

    for (const event of events) {
      // Track cacheKey → streamId index
      for (const cacheKey of options.cacheKeys) {
        this.trackCacheKeyStream(cacheKey, event.streamId)
      }

      // Track for gap detection (use revision, not position — revision is per-stream sequential)
      if (normalizeEventPersistence(event) === 'Permanent') {
        this.gapBuffer.add(event.streamId, event.revision, event)
      }
    }

    return events.length
  }

  /**
   * Cache an anticipated event (optimistic local event).
   *
   * @param event - Anticipated event to cache
   * @param options - Cache options (must include commandId)
   * @returns Generated event ID
   */
  async cacheAnticipatedEvent<T>(
    event: Omit<AnticipatedEvent<T>, 'id' | 'createdAt' | 'persistence'>,
    options: CacheEventOptions & { commandId: string },
  ): Promise<string> {
    const id = generateId()
    const now = Date.now()

    const record: CachedEventRecord = {
      id,
      type: event.type,
      streamId: event.streamId,
      persistence: 'Anticipated',
      data: JSON.stringify(event.data),
      position: null,
      revision: null,
      commandId: options.commandId,
      cacheKeys: options.cacheKeys,
      createdAt: now,
      processedAt: null,
    }

    await this.storage.saveCachedEvent(record)
    return id
  }

  /**
   * Cache multiple anticipated events for a command.
   *
   * @param events - Events to cache
   * @param options - Cache options (must include commandId)
   * @returns Generated event IDs
   */
  async cacheAnticipatedEvents<T>(
    events: Omit<AnticipatedEvent<T>, 'id' | 'createdAt' | 'persistence'>[],
    options: CacheEventOptions & { commandId: string },
  ): Promise<string[]> {
    const now = Date.now()
    const records: CachedEventRecord[] = []
    const ids: string[] = []

    for (const event of events) {
      const id = generateId()
      ids.push(id)

      records.push({
        id,
        type: event.type,
        streamId: event.streamId,
        persistence: 'Anticipated',
        data: JSON.stringify(event.data),
        position: null,
        revision: null,
        commandId: options.commandId,
        cacheKeys: options.cacheKeys,
        createdAt: now,
        processedAt: null,
      })
    }

    if (records.length > 0) {
      await this.storage.saveCachedEvents(records)
    }

    return ids
  }

  /**
   * Get a cached event by ID.
   *
   * @param id - Event ID
   * @returns Cached event record or undefined
   */
  async getEvent(id: string): Promise<CachedEventRecord | undefined> {
    return this.storage.getCachedEvent(id)
  }

  /**
   * Get all events for a cache key.
   *
   * @param cacheKey - Cache key identifier
   * @returns Cached events
   */
  async getEventsByCacheKey(cacheKey: string): Promise<CachedEventRecord[]> {
    return this.storage.getCachedEventsByCacheKey(cacheKey)
  }

  /**
   * Get all events for a stream, sorted by position.
   *
   * @param streamId - Stream identifier
   * @returns Cached events in order
   */
  async getEventsByStream(streamId: string): Promise<CachedEventRecord[]> {
    return this.storage.getCachedEventsByStream(streamId)
  }

  /**
   * Get anticipated events for a command.
   *
   * @param commandId - Command identifier
   * @returns Anticipated events
   */
  async getAnticipatedEventsByCommand(commandId: string): Promise<CachedEventRecord[]> {
    return this.storage.getAnticipatedEventsByCommand(commandId)
  }

  /**
   * Delete anticipated events for a command.
   * Called when command succeeds/fails and anticipated events should be removed.
   *
   * @param commandId - Command identifier
   */
  async deleteAnticipatedEvents(commandId: string): Promise<void> {
    await this.storage.deleteAnticipatedEventsByCommand(commandId)
  }

  /**
   * Get detected gaps in the event stream.
   *
   * @returns Map of stream ID to gaps
   */
  getGaps(): Map<string, EventGap[]> {
    return this.gapBuffer.getGaps()
  }

  /**
   * Get detected gaps for a specific stream.
   *
   * @param streamId - Stream identifier
   * @returns Gaps for the stream, empty array if none
   */
  getStreamGaps(streamId: string): EventGap[] {
    return this.getGaps().get(streamId) ?? []
  }

  /**
   * Get buffered events for a stream, sorted by revision.
   * Used during gap repair to process events in order.
   *
   * @param streamId - Stream identifier
   * @returns Buffered events sorted by position/revision
   */
  getBufferedEvents(streamId: string): { position: bigint; event: IPersistedEvent }[] {
    return this.gapBuffer.getEvents(streamId)
  }

  /**
   * Check if there are any gaps in the event stream.
   *
   * @returns Whether there are gaps
   */
  hasGaps(): boolean {
    const gaps = this.gapBuffer.getGaps()
    for (const streamGaps of gaps.values()) {
      if (streamGaps.length > 0) return true
    }
    return false
  }

  /**
   * Set the known highest position for a stream.
   * Used when resuming from persisted state.
   *
   * @param streamId - Stream identifier
   * @param position - Known highest position
   */
  setKnownPosition(streamId: string, position: bigint): void {
    this.gapBuffer.setKnownPosition(streamId, position)
  }

  /**
   * Clear gap buffer.
   * With both arguments: clears for a specific stream up to a position.
   * With streamId only: clears all gap tracking state for that stream.
   * Without arguments: clears all gap tracking state and the cacheKeyStreams index.
   *
   * @param streamId - Optional stream identifier
   * @param upToPosition - Optional position to clear up to
   */
  clearGapBuffer(streamId?: string, upToPosition?: bigint): void {
    if (streamId !== undefined) {
      if (upToPosition !== undefined) {
        this.gapBuffer.clearUpTo(streamId, upToPosition)
      } else {
        this.gapBuffer.clearStream(streamId)
      }
    } else {
      this.gapBuffer.clear()
      this.cacheKeyStreams.clear()
    }
  }

  /**
   * Clear gap buffer entries for all streams associated with a cache key.
   * Returns the affected streamIds so callers can clean up their own per-stream state.
   *
   * @param cacheKey - Cache key to clear
   * @returns Array of streamIds that were cleared
   */
  /**
   * Add cache key associations to an existing event.
   * Used when a duplicate WS event is relevant to additional active cache keys.
   */
  async addCacheKeysToEvent(eventId: string, cacheKeys: string[]): Promise<void> {
    await this.storage.addCacheKeysToEvent(eventId, cacheKeys)
    // Update in-memory cacheKeyStreams index
    const event = await this.storage.getCachedEvent(eventId)
    if (event) {
      for (const cacheKey of cacheKeys) {
        this.trackCacheKeyStream(cacheKey, event.streamId)
      }
    }
  }

  async clearByCacheKey(cacheKey: string): Promise<string[]> {
    // Remove cache key associations from events in storage, delete orphaned events
    await this.storage.removeCacheKeyFromEvents(cacheKey)

    // Clear in-memory indexes
    const streamIds = this.cacheKeyStreams.get(cacheKey)
    if (!streamIds) return []

    const cleared = Array.from(streamIds)
    for (const streamId of cleared) {
      this.gapBuffer.clearStream(streamId)
    }
    this.cacheKeyStreams.delete(cacheKey)
    return cleared
  }

  /**
   * Cache a command response event for WS dedup and immediate processing.
   * Constructs a CachedEventRecord from a ParsedEvent, saves to storage (INSERT OR IGNORE),
   * and adds to gap buffer for Permanent events.
   *
   * @param event - Parsed event from command response
   */
  async cacheResponseEvent(event: ParsedEvent): Promise<void> {
    const record: CachedEventRecord = {
      id: event.id,
      type: event.type,
      streamId: event.streamId,
      persistence: event.persistence,
      data: JSON.stringify(event.data),
      position: event.position !== undefined ? event.position.toString() : null,
      revision: event.revision !== undefined ? event.revision.toString() : null,
      commandId: event.commandId ?? null,
      cacheKeys: [event.cacheKey],
      createdAt: Date.now(),
      processedAt: null,
    }

    await this.storage.saveCachedEvent(record)

    // Track cacheKey → streamId index
    this.trackCacheKeyStream(event.cacheKey, event.streamId)

    // Add to gap buffer for Permanent events
    if (event.persistence === 'Permanent' && event.revision !== undefined) {
      this.gapBuffer.add(event.streamId, event.revision, toDummyPersistedEvent(event))
    }
  }

  /**
   * Destroy the event cache. Completes subscriptions and clears in-memory state.
   */
  /**
   * Mark events as processed. Sets processedAt timestamp for TTL-based cleanup.
   */
  async markProcessed(ids: string[]): Promise<void> {
    if (ids.length === 0) return
    await this.storage.markCachedEventsProcessed(ids)
  }

  /**
   * Start periodic cleanup of processed events.
   * Deletes events where processedAt is older than ttlMs.
   *
   * @param intervalMs - How often to run cleanup (default 60s)
   * @param ttlMs - Grace window before deletion (default 5 minutes)
   */
  startCleanup(intervalMs = 60_000, ttlMs = 5 * 60_000): void {
    if (this.cleanupTimer) return
    this.cleanupTimer = setInterval(() => {
      this.storage.deleteProcessedCachedEvents(Date.now() - ttlMs).catch((err) => {
        logProvider.log.error({ err }, 'Event cache cleanup failed')
      })
    }, intervalMs)
  }

  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = undefined
    }
    this.destroy$.next()
    this.destroy$.complete()
    this.gapBuffer.clear()
    this.cacheKeyStreams.clear()
  }

  /**
   * Record a streamId under a cache key in the in-memory index.
   */
  private trackCacheKeyStream(cacheKey: string, streamId: string): void {
    let streams = this.cacheKeyStreams.get(cacheKey)
    if (!streams) {
      streams = new Set()
      this.cacheKeyStreams.set(cacheKey, streams)
    }
    streams.add(streamId)
  }
}

/**
 * Create a minimal IPersistedEvent for gap buffer tracking from a ParsedEvent.
 * The gap buffer only uses streamId, revision, and position — other fields
 * are placeholders. The cast is necessary because ParsedEvent.data is `unknown`
 * while IPersistedEvent requires DataType (which demands an `id` field).
 */
function toDummyPersistedEvent(event: ParsedEvent): IPersistedEvent {
  return {
    id: event.id,
    type: event.type,
    streamId: event.streamId,
    data: event.data as IPersistedEvent['data'],
    metadata: { correlationId: event.commandId ?? event.id },
    created: new Date().toISOString(),
    revision: event.revision ?? 0n,
    position: event.position ?? 0n,
  }
}
