/**
 * Event cache manages cached events (permanent, stateful, anticipated).
 *
 * Responsibilities:
 * - Store events by cache key
 * - Track anticipated events by command
 * - Manage event positions and detect gaps
 * - Support event replacement when server confirms
 */

import type { IPersistedEvent } from '@meticoeus/ddd-es'
import type { CachedEventRecord, IStorage } from '../../storage/IStorage.js'
import type { AnticipatedEvent } from '../../types/events.js'
import { normalizeEventPersistence } from '../../types/events.js'
import { generateId } from '../../utils/uuid.js'
import type { EventBus } from '../events/EventBus.js'
import { GapBuffer, type EventGap } from './GapDetector.js'

/**
 * Event cache configuration.
 */
export interface EventCacheConfig {
  storage: IStorage
  eventBus: EventBus
}

/**
 * Options for caching an event.
 */
export interface CacheEventOptions {
  /** Cache key to associate with */
  cacheKey: string
  /** For anticipated events, the command ID */
  commandId?: string
}

/**
 * Event cache implementation.
 */
export class EventCache {
  private readonly storage: IStorage
  private readonly eventBus: EventBus
  private readonly gapBuffer: GapBuffer<IPersistedEvent>

  constructor(config: EventCacheConfig) {
    this.storage = config.storage
    this.eventBus = config.eventBus
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
      cacheKey: options.cacheKey,
      createdAt: new Date(event.created).getTime(),
    }

    await this.storage.saveCachedEvent(record)

    // Track for gap detection (use revision, not position — revision is per-stream sequential)
    if (persistence === 'Permanent') {
      this.gapBuffer.add(event.streamId, event.revision, event)
    }

    return true
  }

  /**
   * Cache multiple persisted events in batch.
   *
   * @param events - Events to cache
   * @param options - Cache options
   * @returns Number of events cached (excludes duplicates)
   */
  async cacheServerEvents(events: IPersistedEvent[], options: CacheEventOptions): Promise<number> {
    const records: CachedEventRecord[] = []

    for (const event of events) {
      const existing = await this.storage.getCachedEvent(event.id)
      if (existing) continue

      const persistence = normalizeEventPersistence(event)
      records.push({
        id: event.id,
        type: event.type,
        streamId: event.streamId,
        persistence,
        data: JSON.stringify(event.data),
        position: event.position.toString(),
        revision: event.revision.toString(),
        commandId: null,
        cacheKey: options.cacheKey,
        createdAt: new Date(event.created).getTime(),
      })
    }

    if (records.length > 0) {
      await this.storage.saveCachedEvents(records)
    }

    return records.length
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
      cacheKey: options.cacheKey,
      createdAt: now,
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
        cacheKey: options.cacheKey,
        createdAt: now,
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
   * @returns Cached event record or null
   */
  async getEvent(id: string): Promise<CachedEventRecord | null> {
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
   * Replace anticipated events with confirmed server events.
   * Called when a command succeeds and server returns actual events.
   *
   * @param commandId - Command identifier
   * @param confirmedEvents - Server-confirmed events
   * @param cacheKey - Cache key for the confirmed events
   */
  async replaceAnticipatedWithConfirmed(
    commandId: string,
    confirmedEvents: IPersistedEvent[],
    cacheKey: string,
  ): Promise<void> {
    // Delete anticipated events
    await this.storage.deleteAnticipatedEventsByCommand(commandId)

    // Cache confirmed events
    await this.cacheServerEvents(confirmedEvents, { cacheKey })
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
   * With arguments: clears for a specific stream up to a position.
   * Without arguments: clears all gap tracking state.
   *
   * @param streamId - Optional stream identifier
   * @param upToPosition - Optional position to clear up to
   */
  clearGapBuffer(streamId?: string, upToPosition?: bigint): void {
    if (streamId !== undefined && upToPosition !== undefined) {
      this.gapBuffer.clearUpTo(streamId, upToPosition)
    } else {
      this.gapBuffer.clear()
    }
  }
}
