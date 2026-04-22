/**
 * Write queue — serializes all local storage mutations.
 *
 * Operations are processed sequentially in FIFO order.
 * Session reset is queue control flow: discard pending, await in-flight, invoke callback.
 *
 * Internal state machine: idle → processing → idle, or * → resetting → idle, or * → destroyed.
 */

import { assert } from '#utils'
import { Err, Ok, logProvider, type Link, type Result } from '@meticoeus/ddd-es'
import type { EnqueueCommand } from '../../types/index.js'
import type { EventBus } from '../events/EventBus.js'
import {
  EnqueueOptions,
  IWriteQueue,
  SessionResetCallback,
  SessionResetException,
  WriteQueueDebugState,
  WriteQueueDestroyedException,
  WriteQueueEvictionHandler,
  WriteQueueEvictionHandlerMap,
  WriteQueueException,
  WriteQueueHandler,
  WriteQueueHandlerMap,
} from './IWriteQueue.js'
import type { WriteQueueOp } from './operations.js'
import { ALL_OP_TYPES } from './operations.js'
import { QueueState } from './WriteQueueState.js'

interface PendingEntry<TLink extends Link, TCommand extends EnqueueCommand> {
  opId: string
  op: WriteQueueOp<TLink, TCommand>
  priority: number
  enqueuedAt: number
  resolve: (value: Result<void, WriteQueueException>) => void
  reject: (err: Error) => void
}

/**
 * Write queue implementation.
 */
export class WriteQueue<TLink extends Link, TCommand extends EnqueueCommand> implements IWriteQueue<
  TLink,
  TCommand
> {
  private readonly handlers: WriteQueueHandlerMap<TLink, TCommand> = {}
  private readonly evictionHandlers: WriteQueueEvictionHandlerMap<TLink, TCommand> = {}
  private readonly pending: PendingEntry<TLink, TCommand>[] = []
  private sessionResetHandler: SessionResetCallback | undefined
  private state: QueueState = { status: 'idle' }
  private currentOp: WriteQueueOp<TLink, TCommand> | undefined
  private boostrapValidation: ReturnType<typeof setTimeout> | undefined
  private opIdCounter = 0

  constructor(private readonly eventBus: EventBus<TLink>) {
    this.boostrapValidation = setTimeout(() => {
      const missingHandlers = ALL_OP_TYPES.filter((type) => !this.handlers[type])
      assert(
        missingHandlers.length === 0,
        `WriteQueue: missing handlers for operation types: ${missingHandlers.join(', ')}`,
      )
      const missingEviction = ALL_OP_TYPES.filter((type) => !this.evictionHandlers[type])
      assert(
        missingEviction.length === 0,
        `WriteQueue: missing eviction handlers for operation types: ${missingEviction.join(', ')}`,
      )
      assert(this.sessionResetHandler, 'WriteQueue: session reset handler not set')
    }, 0)
  }

  setSessionResetHandler(handler: SessionResetCallback): void {
    assert(!this.sessionResetHandler, 'WriteQueue: session reset handler already set')
    this.sessionResetHandler = handler
  }

  register<K extends WriteQueueOp<TLink, TCommand>['type']>(
    type: K,
    handler: WriteQueueHandler<
      TLink,
      TCommand,
      Extract<WriteQueueOp<TLink, TCommand>, { type: K }>
    >,
  ): void {
    assert(!this.handlers[type], `WriteQueue: handler already registered for '${type}'`)
    this.handlers[type] = handler as WriteQueueHandlerMap<TLink, TCommand>[K]
  }

  registerEviction<K extends WriteQueueOp<TLink, TCommand>['type']>(
    type: K,
    handler: WriteQueueEvictionHandler<Extract<WriteQueueOp<TLink, TCommand>, { type: K }>>,
  ): void {
    assert(
      !this.evictionHandlers[type],
      `WriteQueue: eviction handler already registered for '${type}'`,
    )
    this.evictionHandlers[type] = handler as WriteQueueEvictionHandlerMap<TLink, TCommand>[K]
  }

  enqueue(
    op: WriteQueueOp<TLink, TCommand>,
    options?: EnqueueOptions,
  ): Promise<Result<void, WriteQueueException>> {
    switch (this.state.status) {
      case 'destroyed':
        return Promise.resolve(Err(new WriteQueueDestroyedException()))
      case 'resetting':
        return Promise.resolve(Err(new SessionResetException(this.state.reason)))
      case 'idle':
      case 'processing': {
        const opId = String(++this.opIdCounter)
        const priority = options?.priority ?? 0
        return new Promise((resolve, reject) => {
          const entry: PendingEntry<TLink, TCommand> = {
            opId,
            op,
            priority,
            enqueuedAt: Date.now(),
            resolve,
            reject,
          }

          // Insert in priority order (higher priority first, FIFO within same priority)
          const insertIndex = this.pending.findIndex((e) => e.priority < priority)
          if (insertIndex === -1) {
            this.pending.push(entry)
          } else {
            this.pending.splice(insertIndex, 0, entry)
          }

          this.eventBus.emitDebug('writequeue:op-enqueued', {
            opId,
            opType: op.type,
            priority,
            op: op as unknown,
          })
          this.scheduleProcessing()
        })
      }
    }
  }

  async resetSession(reason: string): Promise<void> {
    if (this.state.status === 'destroyed') return

    // If already resetting, return the in-flight reset promise
    if (this.state.status === 'resetting') return this.state.promise

    // Capture the processing settled promise before transitioning
    const processingSettled =
      this.state.status === 'processing' ? this.state.settled : Promise.resolve()

    // Discard all pending ops immediately
    this.discardPendingOps(reason)

    // Transition to resetting — the promise is stored so concurrent callers can join it
    const promise = this.doResetSession(reason, processingSettled)
    this.state = { status: 'resetting', reason, promise }
    this.eventBus.emitDebug('writequeue:reset-started', { reason })

    try {
      await promise
    } finally {
      this.eventBus.emitDebug('writequeue:reset-completed', { reason })
      // Only transition back to idle if we're still in the resetting state
      // (destroy could have been called during reset)
      if (this.state.status === 'resetting') {
        this.state = { status: 'idle' }
      }
    }
  }

  getDebugState(): WriteQueueDebugState<TLink, TCommand> {
    const pendingByType: Partial<Record<WriteQueueOp<TLink, TCommand>['type'], number>> = {}
    for (const entry of this.pending) {
      const count = pendingByType[entry.op.type] ?? 0
      pendingByType[entry.op.type] = count + 1
    }

    return {
      status: this.state.status,
      pendingCount: this.pending.length,
      currentOpType: this.currentOp?.type,
      pendingByType,
    }
  }

  destroy(): void {
    if (this.boostrapValidation) {
      // This should only occur in testing
      clearTimeout(this.boostrapValidation)
    }
    const exception = new WriteQueueDestroyedException()
    for (const entry of this.pending) {
      entry.resolve(Err(exception))
      this.invokeEvictionHandler(entry.op, exception)
    }
    this.pending.length = 0
    this.currentOp = undefined
    this.state = { status: 'destroyed' }
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private scheduleProcessing(): void {
    if (this.state.status !== 'idle') return
    if (this.pending.length === 0) return

    // Use a microtask to avoid synchronous reentrancy from handler or resolve callbacks
    void Promise.resolve().then(() => this.runLoop())
  }

  private async runLoop(): Promise<void> {
    if (this.state.status !== 'idle') return

    let settledResolve!: () => void
    const settled = new Promise<void>((resolve) => {
      settledResolve = resolve
    })
    this.state = { status: 'processing', settled, settledResolve }

    try {
      while (this.pending.length > 0) {
        // Break if state changed (reset or destroy happened between ops)
        if (this.state.status !== 'processing') break

        // Cast justified: while condition guarantees pending.length > 0, so shift() cannot return undefined.
        const entry = this.pending.shift() as PendingEntry<TLink, TCommand>
        this.currentOp = entry.op

        try {
          const handler = this.handlers[entry.op.type]
          assert(handler, `WriteQueue: no handler registered for '${entry.op.type}'`)
          this.eventBus.emitDebug('writequeue:op-started', {
            opId: entry.opId,
            opType: entry.op.type,
          })
          const startedAt = Date.now()
          await (handler as (op: WriteQueueOp<TLink, TCommand>) => Promise<void>)(entry.op)
          entry.resolve(Ok())
          this.eventBus.emitDebug('writequeue:op-completed', {
            opId: entry.opId,
            opType: entry.op.type,
            durationMs: Date.now() - startedAt,
          })
        } catch (error) {
          logProvider.log.error({ err: error, opType: entry.op.type }, 'Write queue handler error')
          this.eventBus.emitDebug('writequeue:op-error', {
            opId: entry.opId,
            opType: entry.op.type,
            error: error instanceof Error ? error.message : String(error),
          })
          entry.reject(error instanceof Error ? error : new Error(String(error)))
        }

        this.currentOp = undefined
      }
    } finally {
      // Signal that processing has settled — resetSession awaits this
      settledResolve()

      // Transition to idle only if still processing (reset/destroy may have changed state)
      if (this.state.status === 'processing') {
        this.state = { status: 'idle' }
      }
    }
  }

  /**
   * Await the in-flight operation, then invoke the session reset callback.
   */
  private async doResetSession(reason: string, processingSettled: Promise<void>): Promise<void> {
    await processingSettled
    assert(this.sessionResetHandler, 'WriteQueue: session reset handler not set')
    await this.sessionResetHandler(reason)
  }

  /**
   * Invoke the eviction handler for a discarded op.
   */
  private invokeEvictionHandler(
    op: WriteQueueOp<TLink, TCommand>,
    reason: WriteQueueException,
  ): void {
    const handler = this.evictionHandlers[op.type]
    assert(handler, `WriteQueue: no eviction handler registered for '${op.type}'`)
    ;(handler as (op: WriteQueueOp<TLink, TCommand>, r: WriteQueueException) => void)(op, reason)
  }

  /**
   * Discard all pending operations, resolving each with Err(SessionResetException).
   * Invokes eviction handlers for ops that have one registered.
   */
  private discardPendingOps(reason: string): void {
    const exception = new SessionResetException(reason)
    for (const entry of this.pending) {
      entry.resolve(Err(exception))
      this.invokeEvictionHandler(entry.op, exception)
      this.eventBus.emitDebug('writequeue:op-discarded', {
        opId: entry.opId,
        opType: entry.op.type,
        reason,
      })
    }
    this.pending.length = 0
  }
}
