import type { IPersistedEvent, Link } from '@meticoeus/ddd-es'
import type { SeedRecord } from '../../types/config.js'
import type { CacheKeyIdentity } from '../cache-manager/index.js'
import type { IAnticipatedEvent } from '../command-lifecycle/AnticipatedEventShape.js'

// ---------------------------------------------------------------------------
// Data operations — normal sequential processing
// ---------------------------------------------------------------------------

/**
 * Write a page of read model records to storage.
 * Used by both initial seeding and invalidation refetch — same write logic, different trigger.
 */
export interface ApplyRecordsOp<TLink extends Link> {
  type: 'apply-records'
  source: 'seed' | 'refetch'
  collection: string
  cacheKey: CacheKeyIdentity<TLink>
  records: SeedRecord[]
}

/**
 * Cache and process a page of events from an event-based seed fetch.
 */
export interface ApplySeedEventsOp {
  type: 'apply-seed-events'
  collection: string
  cacheKey: string
  events: IPersistedEvent[]
}

/**
 * Cache a WebSocket event, check for gaps, and potentially process it.
 *
 * The handler must:
 * 1. Cache to EventCache (with cacheKeys)
 * 2. Check revision order (gap detection)
 * 3. If in order: process through EventProcessorRunner for each cache key
 * 4. If gap detected: buffer the event and trigger repair fetch (outside queue)
 */
export interface ApplyWsEventOp<TLink extends Link> {
  type: 'apply-ws-event'
  event: IPersistedEvent
  cacheKeys: CacheKeyIdentity<TLink>[]
}

/**
 * Cache and process anticipated events from a command enqueue.
 */
export interface ApplyAnticipatedOp {
  type: 'apply-anticipated'
  commandId: string
  events: IAnticipatedEvent[]
  cacheKey: string
  /**
   * For creates with temporary ID: the client-generated entity ID.
   * Passed through to the anticipated event handler for _clientMetadata tracking.
   */
  clientId?: string
}

/**
 * Cache fetched events and drain the gap buffer for a stream after a repair fetch completes.
 * The handler caches the fetched events (SQLite + GapBuffer), then drains the full GapBuffer
 * in revision order through EventProcessorRunner.
 */
export interface ApplyGapRepairOp {
  type: 'apply-gap-repair'
  streamId: string
  cacheKeys: string[]
  events: IPersistedEvent[]
}

/**
 * Evict all data for a cache key.
 * Processed sequentially like other data operations — the queue's serialization
 * prevents interleaving with other writes.
 */
export interface EvictCacheKeyOp {
  type: 'evict-cache-key'
  cacheKey: string
}

/**
 * Flush dirty cache key registry entries to SQL storage.
 * Batches multiple in-memory updates into a single write.
 * The in-memory registry is always ahead of SQL — this is just durability.
 */
export interface FlushCacheKeysOp {
  type: 'flush-cache-keys'
}

/**
 * Discriminated union of all write queue operation types.
 * Processed sequentially in FIFO order.
 */
export type WriteQueueOp<TLink extends Link> =
  | ApplyRecordsOp<TLink>
  | ApplySeedEventsOp
  | ApplyWsEventOp<TLink>
  | ApplyAnticipatedOp
  | ApplyGapRepairOp
  | EvictCacheKeyOp
  | FlushCacheKeysOp

/**
 * All operation type tags. Used by the queue to assert handler completeness at bootstrap.
 */
export const ALL_OP_TYPES: readonly WriteQueueOp<Link>['type'][] = [
  'apply-records',
  'apply-seed-events',
  'apply-ws-event',
  'apply-anticipated',
  'apply-gap-repair',
  'evict-cache-key',
  'flush-cache-keys',
] as const
