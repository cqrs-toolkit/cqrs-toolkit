import type { Link, Result } from '@meticoeus/ddd-es'
import type { CommandRecord, EnqueueCommand } from '../../types/index.js'
import { WriteQueueException } from '../write-queue/IWriteQueue.js'
import type { IAnticipatedEvent } from './AnticipatedEventShape.js'

/**
 * Handler for anticipated event lifecycle.
 * CommandQueue hands off anticipated events at the right lifecycle points — the handler
 * implementation coordinates EventCache, CacheManager, and collection routing.
 *
 * Cleanup is split across the three terminal-ish transitions:
 *   - {@link cleanupOnSucceeded}: command server-acked. Retains tracking for
 *     the pipeline's later `'succeeded' → 'applied'` transition.
 *   - {@link cleanupOnAppliedBatch}: pipeline has reflected effects in `serverData`.
 *     Drops tracking and EventCache state; does NOT touch read-model overlays
 *     (they have already been replaced by server data).
 *   - {@link cleanupOnFailure}: command will never succeed. Reverts the
 *     optimistic overlay via `clearLocalChanges`.
 */
export interface IAnticipatedEventHandler<TLink extends Link, TCommand extends EnqueueCommand> {
  /**
   * Cache anticipated events in EventCache and send through event processor pipeline.
   */
  cache<TEvent extends IAnticipatedEvent>(params: {
    /** Command that produced these events */
    command: CommandRecord<TLink, TCommand>
    /** Anticipated events to cache */
    events: TEvent[]
    /**
     * For creates with temporary ID: the client-generated entity ID.
     * When provided, sets `_clientMetadata` on the created read model entries so the
     * original ID can be tracked through server ID reconciliation.
     */
    clientId?: string
  }): Promise<Result<void, WriteQueueException>>
  /**
   * Clean up anticipated events when a command transitions to `'succeeded'`.
   * Prunes EventCache anticipated events. Retains `anticipatedUpdates` so the
   * pipeline can later migrate to `'applied'` using the same tracked entity set.
   */
  cleanupOnSucceeded(commandId: string): Promise<void>
  /**
   * Clean up anticipated events when one or more commands transition to
   * `'applied'` (pipeline-owned transition). Prunes EventCache and drops
   * `anticipatedUpdates` entries. Does NOT touch read-model overlays — the
   * sync pipeline has already replaced them with authoritative server data.
   *
   * Always called with a batch — the pipeline reports all applied commands
   * for a drain at once. Implementations may loop internally until a proper
   * batched backing call lands.
   */
  cleanupOnAppliedBatch(commandIds: Iterable<string>): Promise<void>
  /**
   * Clean up anticipated events when a command transitions to `'failed'` or
   * `'cancelled'`. Prunes EventCache, drops `anticipatedUpdates`, and reverts
   * the optimistic overlay via `readModelStore.clearLocalChanges` for every
   * tracked entry. The overlay will never be superseded by real events, so
   * reverting to the server baseline (or deletion, for client-only creates)
   * is the only correct outcome.
   */
  cleanupOnFailure(commandId: string): Promise<void>
  /** Replace anticipated events for a command (used when data is rewritten after a dependency succeeds). */
  regenerate<TEvent extends IAnticipatedEvent>(
    command: CommandRecord<TLink, TCommand>,
    newEvents: TEvent[],
  ): Promise<void>
  /** Get tracked read model entries for a command (e.g., ["todos:client-abc"]). */
  getTrackedEntries(commandId: string): string[] | undefined
  /**
   * Replace the tracked read model entries for a command. Used by the reconcile
   * pipeline when anticipated events are rebuilt outside the `cache`/`regenerate`
   * paths — the pipeline computes the new tracked set from the recomputed events
   * and hands it back so subsequent `getTrackedEntries`, `cleanupOnAppliedBatch`,
   * and `cleanupOnFailure` calls operate on the correct entity set.
   */
  setTrackedEntries(commandId: string, entries: string[]): void
  /** Clear all tracking state (in-memory only — storage cleanup handled by session cascade). */
  clearAll(): Promise<void>
}
