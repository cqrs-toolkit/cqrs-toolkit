/**
 * Write queue — serializes all local storage mutations.
 *
 * Operations are processed sequentially in FIFO order.
 * Session reset is queue control flow: discard pending, await in-flight, invoke callback.
 *
 * Internal state machine: idle → processing → idle, or * → resetting → idle, or * → destroyed.
 */

import { Err, Ok, logProvider, type Link, type Result } from '@meticoeus/ddd-es'
import { assert } from '../../utils/assert.js'
import {
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

// ---------------------------------------------------------------------------
// State machine
// ---------------------------------------------------------------------------

interface IdleState {
  status: 'idle'
}

interface ProcessingState {
  status: 'processing'
  /** Resolved by runLoop's finally block when it exits. */
  settled: Promise<void>
  settledResolve: () => void
}

interface ResettingState {
  status: 'resetting'
  reason: string
  promise: Promise<void>
}

interface DestroyedState {
  status: 'destroyed'
}

type QueueState = IdleState | ProcessingState | ResettingState | DestroyedState

// ---------------------------------------------------------------------------
// Pending entry
// ---------------------------------------------------------------------------

interface PendingEntry<TLink extends Link> {
  op: WriteQueueOp<TLink>
  resolve: (value: Result<void, WriteQueueException>) => void
  reject: (err: Error) => void
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Write queue implementation.
 */
export class WriteQueue<TLink extends Link> implements IWriteQueue<TLink> {
  private readonly handlers: WriteQueueHandlerMap<TLink> = {}
  private readonly evictionHandlers: WriteQueueEvictionHandlerMap<TLink> = {}
  private readonly pending: PendingEntry<TLink>[] = []
  private sessionResetHandler: SessionResetCallback | undefined
  private state: QueueState = { status: 'idle' }
  private currentOp: WriteQueueOp<TLink> | undefined
  private boostrapValidation: ReturnType<typeof setTimeout> | undefined

  constructor() {
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

  register<K extends WriteQueueOp<TLink>['type']>(
    type: K,
    handler: WriteQueueHandler<TLink, Extract<WriteQueueOp<TLink>, { type: K }>>,
  ): void {
    assert(!this.handlers[type], `WriteQueue: handler already registered for '${type}'`)
    this.handlers[type] = handler as WriteQueueHandlerMap<TLink>[K]
  }

  registerEviction<K extends WriteQueueOp<TLink>['type']>(
    type: K,
    handler: WriteQueueEvictionHandler<Extract<WriteQueueOp<TLink>, { type: K }>>,
  ): void {
    assert(
      !this.evictionHandlers[type],
      `WriteQueue: eviction handler already registered for '${type}'`,
    )
    this.evictionHandlers[type] = handler as WriteQueueEvictionHandlerMap<TLink>[K]
  }

  enqueue(op: WriteQueueOp<TLink>): Promise<Result<void, WriteQueueException>> {
    switch (this.state.status) {
      case 'destroyed':
        return Promise.resolve(Err(new WriteQueueDestroyedException()))
      case 'resetting':
        return Promise.resolve(Err(new SessionResetException(this.state.reason)))
      case 'idle':
      case 'processing':
        return new Promise((resolve, reject) => {
          this.pending.push({ op, resolve, reject })
          this.scheduleProcessing()
        })
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

    try {
      await promise
    } finally {
      // Only transition back to idle if we're still in the resetting state
      // (destroy could have been called during reset)
      if (this.state.status === 'resetting') {
        this.state = { status: 'idle' }
      }
    }
  }

  getDebugState(): WriteQueueDebugState<TLink> {
    const pendingByType: Partial<Record<WriteQueueOp<TLink>['type'], number>> = {}
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
        const entry = this.pending.shift() as PendingEntry<TLink>
        this.currentOp = entry.op

        try {
          const handler = this.handlers[entry.op.type]
          assert(handler, `WriteQueue: no handler registered for '${entry.op.type}'`)
          await (handler as (op: WriteQueueOp<TLink>) => Promise<void>)(entry.op)
          entry.resolve(Ok())
        } catch (error) {
          logProvider.log.error({ err: error, opType: entry.op.type }, 'Write queue handler error')
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
  private invokeEvictionHandler(op: WriteQueueOp<TLink>, reason: WriteQueueException): void {
    const handler = this.evictionHandlers[op.type]
    assert(handler, `WriteQueue: no eviction handler registered for '${op.type}'`)
    ;(handler as (op: WriteQueueOp<TLink>, r: WriteQueueException) => void)(op, reason)
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
    }
    this.pending.length = 0
  }
}
