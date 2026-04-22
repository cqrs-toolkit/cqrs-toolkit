/**
 * Write queue types for serializing local storage mutations.
 *
 * The queue serializes all SQLite writes (read models, event cache, cache key mutations).
 * Network operations run outside the queue — only their results enter as queue items.
 */

import { Exception, type Link, type Result } from '@meticoeus/ddd-es'
import type { EnqueueCommand } from '../../types/index.js'
import type { WriteQueueOp } from './operations.js'

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

/**
 * Handler function for a specific operation type.
 *
 * Each subsystem registers handlers for the operation types it owns.
 * The queue dispatches to the registered handler when processing an operation.
 *
 * Handlers must throw only for infrastructure/external failures (category 3 errors).
 * A thrown error rejects the enqueue promise and is logged, but does not stop the drain loop.
 * Expected domain failures should be handled within the handler itself — not thrown.
 */
export interface WriteQueueHandler<
  TLink extends Link,
  TCommand extends EnqueueCommand,
  TOp extends WriteQueueOp<TLink, TCommand>,
> {
  (op: TOp): Promise<void>
}

/**
 * Maps each operation type tag to the handler function for that operation.
 * Used internally by the queue for dispatch.
 */
export type WriteQueueHandlerMap<TLink extends Link, TCommand extends EnqueueCommand> = {
  [K in WriteQueueOp<TLink, TCommand>['type']]?: WriteQueueHandler<
    TLink,
    TCommand,
    Extract<WriteQueueOp<TLink, TCommand>, { type: K }>
  >
}

/**
 * Eviction handler for a specific operation type.
 *
 * Called synchronously when a pending (not-yet-started) operation is discarded
 * by session reset or queue destruction. Allows subsystems to clean up local
 * side-state (guards, debug events) that would otherwise leak.
 *
 * Must be synchronous — eviction is fast cleanup, not more work.
 * The in-flight operation is not evicted; it completes normally.
 */
export interface WriteQueueEvictionHandler<TOp> {
  (op: TOp, reason: WriteQueueException): void
}

/**
 * Maps each operation type tag to the eviction handler for that operation.
 * Used internally by the queue for dispatch during discard.
 */
export type WriteQueueEvictionHandlerMap<TLink extends Link, TCommand extends EnqueueCommand> = {
  [K in WriteQueueOp<TLink, TCommand>['type']]?: WriteQueueEvictionHandler<
    Extract<WriteQueueOp<TLink, TCommand>, { type: K }>
  >
}

/**
 * Options for enqueue operations.
 */
export interface EnqueueOptions {
  /** Priority level. Higher values are processed first. Default: 0. */
  priority?: number
}

// ---------------------------------------------------------------------------
// Queue state
// ---------------------------------------------------------------------------

/**
 * Queue processing status.
 */
export type WriteQueueStatus = 'idle' | 'processing' | 'resetting' | 'destroyed'

/**
 * Debug snapshot of the write queue state.
 */
export interface WriteQueueDebugState<TLink extends Link, TCommand extends EnqueueCommand> {
  status: WriteQueueStatus
  pendingCount: number
  currentOpType: WriteQueueOp<TLink, TCommand>['type'] | undefined
  pendingByType: Partial<Record<WriteQueueOp<TLink, TCommand>['type'], number>>
}

// ---------------------------------------------------------------------------
// Queue interface
// ---------------------------------------------------------------------------

/**
 * Write queue interface.
 *
 * Serializes all local SQLite mutations in a CQRS client.
 * Network operations run concurrently outside the queue — only their
 * results enter via `enqueue()`.
 *
 * Subsystems register handlers for the operation types they own via `register()`.
 * Each operation type has exactly one handler. After one tick, the queue asserts
 * that all operation types have handlers — missing registrations throw.
 */
export interface IWriteQueue<TLink extends Link, TCommand extends EnqueueCommand> {
  /**
   * Register a handler for an operation type.
   * Called by subsystems at bootstrap (typically in constructors).
   * Each operation type must have exactly one handler — duplicate registration throws.
   */
  register<K extends WriteQueueOp<TLink, TCommand>['type']>(
    type: K,
    handler: WriteQueueHandler<
      TLink,
      TCommand,
      Extract<WriteQueueOp<TLink, TCommand>, { type: K }>
    >,
  ): void

  /**
   * Register an eviction handler for an operation type.
   * Called when a pending operation of this type is discarded by session reset or destroy.
   * Every operation type must have an eviction handler — use a noop if no cleanup is needed.
   */
  registerEviction<K extends WriteQueueOp<TLink, TCommand>['type']>(
    type: K,
    handler: WriteQueueEvictionHandler<Extract<WriteQueueOp<TLink, TCommand>, { type: K }>>,
  ): void

  /**
   * Enqueue a data operation for sequential processing.
   *
   * Returns `Ok(undefined)` when the operation has been processed successfully.
   * Returns `Err(SessionResetException)` if the operation was discarded by a session reset.
   * Returns `Err(WriteQueueDestroyedException)` if the queue has been destroyed.
   *
   * Rejects the promise only for infrastructure errors (handler threw).
   */
  enqueue(
    op: WriteQueueOp<TLink, TCommand>,
    options?: EnqueueOptions,
  ): Promise<Result<void, WriteQueueException>>

  /**
   * Set the session reset callback. Must be called before resetSession is used.
   */
  setSessionResetHandler(handler: SessionResetCallback): void

  /**
   * Reset the session. This is queue control flow, not a work item.
   *
   * Behavior:
   * 1. Immediately discards all pending data operations (their promises resolve with Err).
   * 2. Awaits the currently in-flight operation (if any).
   * 3. Invokes the onSessionReset callback provided at construction.
   * 4. Resolves when complete.
   *
   * If called while a reset is already in progress, returns the existing reset promise.
   * Enqueue calls during an active reset return Err(SessionResetException) immediately.
   */
  resetSession(reason: string): Promise<void>

  /**
   * Get a debug snapshot of the queue state.
   */
  getDebugState(): WriteQueueDebugState<TLink, TCommand>

  /**
   * Destroy the queue. Resolves pending enqueue promises with Err and clears state.
   * Not reversible — create a new instance after destroy.
   */
  destroy(): void
}

/**
 * Callback invoked during session reset after pending ops are discarded and in-flight settles.
 */
export interface SessionResetCallback {
  (reason: string): Promise<void>
}

// ---------------------------------------------------------------------------
// Exception types
// ---------------------------------------------------------------------------

export type WriteQueueException = SessionResetException | WriteQueueDestroyedException

/**
 * Expected domain failure: the operation was discarded because the session was reset.
 * Callers should treat this as a graceful cancellation and stop their current work.
 */
export class SessionResetException extends Exception {
  readonly errorCode = 'SESSION_RESET'

  constructor(reason: string) {
    super('SessionResetException', `Operation discarded: session reset (${reason})`)
  }
}

/**
 * Expected domain failure: the queue has been destroyed.
 * Callers should treat this as a graceful shutdown signal.
 */
export class WriteQueueDestroyedException extends Exception {
  readonly errorCode = 'WRITE_QUEUE_DESTROYED'

  constructor() {
    super('WriteQueueDestroyedException', 'Write queue has been destroyed')
  }
}
