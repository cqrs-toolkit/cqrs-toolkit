/**
 * Write queue state machine states
 *
 * Internal state machine: idle → processing → idle, or * → resetting → idle, or * → destroyed.
 */

export interface IdleState {
  status: 'idle'
}

export interface ProcessingState {
  status: 'processing'
  /** Resolved by runLoop's finally block when it exits. */
  settled: Promise<void>
  settledResolve: () => void
}

export interface ResettingState {
  status: 'resetting'
  reason: string
  promise: Promise<void>
}

export interface DestroyedState {
  status: 'destroyed'
}

export type QueueState = IdleState | ProcessingState | ResettingState | DestroyedState
