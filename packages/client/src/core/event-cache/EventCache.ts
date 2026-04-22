/**
 * Event cache manages cached events (permanent, stateful, anticipated).
 *
 * Responsibilities:
 * - Store events by cache key
 * - Track anticipated events by command
 * - Manage event positions and detect gaps
 * - Support event replacement when server confirms
 */

import { generateId } from '#utils'
import { IPersistedEvent, Link, logProvider } from '@meticoeus/ddd-es'
import { Subject } from 'rxjs'
import type { CachedEventRecord, IStorage } from '../../storage/IStorage.js'
import type { AnticipatedEvent } from '../../types/events.js'
import { normalizeEventPersistence } from '../../types/events.js'
import { EnqueueCommand } from '../../types/index.js'
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
 * Entry shape for {@link EventCache.cacheServerEventsWithKeys}. Each entry
 * carries its own cacheKeys, so the batch may mix events whose cacheKey
 * sets differ.
 */
export interface CacheServerEventEntry {
  event: IPersistedEvent
  cacheKeys: readonly string[]
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

  constructor(private readonly storage: IStorage<TLink, TCommand>) {
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
      commandId: extractCommandId(event),
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
   * Cache multiple persisted events in a single storage round-trip. Each
   * entry carries its own cacheKeys, so a batch may mix events whose
   * cacheKey sets differ.
   *
   * Duplicates are silently ignored by the storage layer (INSERT OR IGNORE).
   *
   * @param entries - Events to cache, each with its own cacheKeys
   * @returns Number of entries submitted (duplicates silently skipped by storage)
   */
  async cacheServerEventsWithKeys(entries: readonly CacheServerEventEntry[]): Promise<number> {
    const records: CachedEventRecord[] = entries.map(({ event, cacheKeys }) => ({
      id: event.id,
      type: event.type,
      streamId: event.streamId,
      persistence: normalizeEventPersistence(event),
      data: JSON.stringify(event.data),
      position: event.position.toString(),
      revision: event.revision.toString(),
      commandId: extractCommandId(event),
      cacheKeys: [...cacheKeys],
      createdAt: new Date(event.created).getTime(),
      processedAt: null,
    }))

    await this.storage.saveCachedEvents(records)

    for (const { event, cacheKeys } of entries) {
      for (const cacheKey of cacheKeys) {
        this.trackCacheKeyStream(cacheKey, event.streamId)
      }

      if (normalizeEventPersistence(event) === 'Permanent') {
        this.gapBuffer.add(event.streamId, event.revision, event)
      }
    }

    return entries.length
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
   * Bulk existence check — returns the subset of ids that are already
   * stored in the cache. Used by the WS drain dedup pass to partition a
   * batch into "new" vs "already-seen" without N round-trips.
   *
   * @param ids - Candidate event IDs
   * @returns Set of ids that are already present
   */
  async getExistingEventIds(ids: readonly string[]): Promise<Set<string>> {
    return this.storage.getExistingCachedEventIds(ids)
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
   * Get all anticipated events across every pending command.
   * Used by reconciliation to bulk-load optimistic overlays in a single query.
   */
  async getAllAnticipatedEvents(): Promise<CachedEventRecord[]> {
    return this.storage.getAllAnticipatedEvents()
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
   * Delete anticipated events for multiple commands in a single storage
   * round-trip. Used by the applied-batch cleanup path in the sync pipeline.
   *
   * @param commandIds - Command identifiers whose anticipated events should be removed
   */
  async deleteAnticipatedEventsForCommands(commandIds: readonly string[]): Promise<void> {
    await this.storage.deleteAnticipatedEventsByCommands(commandIds)
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
   * Add cache-key associations to multiple already-cached events in a single
   * storage round-trip. Used when a WS drain batch contains events that
   * were previously cached under a different active cache-key set.
   *
   * Each entry carries the full event because the in-memory
   * {@link trackCacheKeyStream} index needs `streamId` alongside the id —
   * passing the event avoids a re-fetch round-trip the caller already has
   * the data to avoid.
   */
  async addCacheKeysToEvents(entries: readonly CacheServerEventEntry[]): Promise<void> {
    await this.storage.addCacheKeysToEvents(
      entries.map(({ event, cacheKeys }) => ({ eventId: event.id, cacheKeys })),
    )
    for (const { event, cacheKeys } of entries) {
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

function extractCommandId(event: IPersistedEvent): string | null {
  const metadata = event.metadata
  if ('commandId' in metadata && typeof metadata.commandId === 'string') {
    return metadata.commandId
  }
  return null
}
