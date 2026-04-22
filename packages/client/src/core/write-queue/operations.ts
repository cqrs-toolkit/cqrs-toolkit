import type { IPersistedEvent, Link } from '@meticoeus/ddd-es'
import type { CommandRecord, EnqueueCommand } from '../../types/commands.js'
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
export interface ApplySeedEventsOp<TLink extends Link> {
  type: 'apply-seed-events'
  collection: string
  cacheKey: CacheKeyIdentity<TLink>
  events: IPersistedEvent[]
}

/**
 * Cache and process anticipated events from a command enqueue.
 */
export interface ApplyAnticipatedOp<TLink extends Link, TCommand extends EnqueueCommand> {
  type: 'apply-anticipated'
  command: CommandRecord<TLink, TCommand>
  events: IAnticipatedEvent[]
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
export interface ApplyGapRepairOp<TLink extends Link> {
  type: 'apply-gap-repair'
  streamId: string
  cacheKeys: CacheKeyIdentity<TLink>[]
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
 * Drain all currently pending WS events from the SyncManager's in-memory
 * queue and run them through the reconcile workflow. Carries no payload —
 * the actual events live in SyncManager state and are snapshotted at the
 * start of the handler (so additional events can enqueue concurrently into
 * a fresh batch without racing the in-flight drain).
 */
export interface ReconcileWsEventsOp {
  type: 'reconcile-ws-events'
}

/**
 * Discriminated union of all write queue operation types.
 * Processed sequentially in FIFO order.
 */
export type WriteQueueOp<TLink extends Link, TCommand extends EnqueueCommand> =
  | ApplyRecordsOp<TLink>
  | ApplySeedEventsOp<TLink>
  | ApplyAnticipatedOp<TLink, TCommand>
  | ApplyGapRepairOp<TLink>
  | EvictCacheKeyOp
  | FlushCacheKeysOp
  | ReconcileWsEventsOp

/**
 * All operation type tags. Used by the queue to assert handler completeness at bootstrap.
 */
export const ALL_OP_TYPES: readonly WriteQueueOp<Link, EnqueueCommand>['type'][] = [
  'apply-records',
  'apply-seed-events',
  'apply-anticipated',
  'apply-gap-repair',
  'evict-cache-key',
  'flush-cache-keys',
  'reconcile-ws-events',
] as const
