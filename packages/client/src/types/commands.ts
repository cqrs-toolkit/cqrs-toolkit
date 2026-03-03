/**
 * Command types for the CQRS Client command queue.
 */

import type { ValidationError } from './validation.js'

/**
 * Command lifecycle status.
 */
export type CommandStatus =
  | 'pending' // Queued, not yet processed
  | 'blocked' // Waiting on dependencies
  | 'sending' // In-flight to server
  | 'succeeded' // Server confirmed
  | 'failed' // Failed (local validation or server error)
  | 'cancelled' // User cancelled

/**
 * Error source - where the error originated.
 */
export type CommandErrorSource = 'local' | 'server'

/**
 * Command error - can originate from local validation or server.
 */
export interface CommandError {
  /** Error source */
  source: CommandErrorSource
  /** Human-readable message */
  message: string
  /** Machine-readable code */
  code?: string
  /** Field-level validation errors (for form display) */
  validationErrors?: ValidationError[]
  /** Raw server error details */
  details?: unknown
}

/**
 * Persisted command record.
 */
export interface CommandRecord<TPayload = unknown, TResponse = unknown> {
  /** Unique command identifier (client-generated) */
  commandId: string
  /** Target service for the command */
  service: string
  /** Command type (e.g., 'CreateTodo', 'UpdateUser') */
  type: string
  /** Command payload */
  payload: TPayload
  /** Current status */
  status: CommandStatus
  /** Commands this command depends on (must complete first) */
  dependsOn: string[]
  /** Commands blocked by this command */
  blockedBy: string[]
  /** Number of send attempts */
  attempts: number
  /** Timestamp of last send attempt */
  lastAttemptAt?: number
  /** IDs of anticipated events produced by this command */
  anticipatedEventIds: string[]
  /** Error information if failed */
  error?: CommandError
  /** Server response on success */
  serverResponse?: TResponse
  /** Creation timestamp */
  createdAt: number
  /** Last update timestamp */
  updatedAt: number
}

/**
 * Command to enqueue.
 */
export interface EnqueueCommand<TPayload = unknown> {
  /** Command type */
  type: string
  /** Command payload */
  payload: TPayload
  /** Target service (optional, defaults to primary) */
  service?: string
  /** Commands this depends on (optional) */
  dependsOn?: string[]
}

/**
 * Options for enqueue operation.
 */
export interface EnqueueOptions {
  /** Skip local domain validation */
  skipValidation?: boolean
  /** Custom command ID (defaults to generated UUID) */
  commandId?: string
}

/**
 * Options for waitForCompletion operation.
 */
export interface WaitOptions {
  /** Timeout in milliseconds (default: 30000) */
  timeout?: number
}

/**
 * Options for enqueueAndWait operation.
 */
export interface EnqueueAndWaitOptions extends EnqueueOptions, WaitOptions {}

/**
 * Successful enqueue result.
 */
export interface EnqueueSuccess<TEvent> {
  ok: true
  /** Assigned command ID */
  commandId: string
  /** Anticipated events produced */
  anticipatedEvents: TEvent[]
}

/**
 * Failed enqueue result (validation errors).
 */
export interface EnqueueFailure {
  ok: false
  /** Validation errors */
  errors: ValidationError[]
}

/**
 * Result of enqueue operation.
 */
export type EnqueueResult<TEvent> = EnqueueSuccess<TEvent> | EnqueueFailure

/**
 * Command completion result - succeeded.
 */
export interface CompletionSucceeded {
  status: 'succeeded'
  /** Server response data */
  response: unknown
}

/**
 * Command completion result - failed.
 */
export interface CompletionFailed {
  status: 'failed'
  /** Error information */
  error: CommandError
}

/**
 * Command completion result - cancelled.
 */
export interface CompletionCancelled {
  status: 'cancelled'
}

/**
 * Command completion result - timeout.
 */
export interface CompletionTimeout {
  status: 'timeout'
}

/**
 * Result of waitForCompletion operation.
 */
export type CommandCompletionResult =
  | CompletionSucceeded
  | CompletionFailed
  | CompletionCancelled
  | CompletionTimeout

/**
 * Successful enqueueAndWait result.
 */
export interface EnqueueAndWaitSuccess<TResponse> {
  ok: true
  /** Assigned command ID */
  commandId: string
  /** Server response */
  response: TResponse
}

/**
 * Failed enqueueAndWait result.
 */
export interface EnqueueAndWaitFailure {
  ok: false
  /** Validation errors */
  errors: ValidationError[]
  /** Error source */
  source: CommandErrorSource
}

/**
 * Result of enqueueAndWait operation.
 */
export type EnqueueAndWaitResult<TResponse> =
  | EnqueueAndWaitSuccess<TResponse>
  | EnqueueAndWaitFailure

/**
 * Command event types emitted by the command queue.
 */
export type CommandEventType = 'enqueued' | 'status-changed' | 'completed' | 'failed' | 'cancelled'

/**
 * Command event emitted when a command's state changes.
 */
export interface CommandEvent {
  /** Event type */
  eventType: CommandEventType
  /** Command ID */
  commandId: string
  /** Command type */
  type: string
  /** Current status */
  status: CommandStatus
  /** Previous status (for status-changed events) */
  previousStatus?: CommandStatus
  /** Error information (for failed events) */
  error?: CommandError
  /** Server response (for completed events) */
  response?: unknown
  /** Event timestamp */
  timestamp: number
}

/**
 * Filter for listing commands.
 */
export interface CommandFilter {
  /** Filter by status */
  status?: CommandStatus | CommandStatus[]
  /** Filter by type */
  type?: string | string[]
  /** Filter by service */
  service?: string
  /** Created after timestamp */
  createdAfter?: number
  /** Created before timestamp */
  createdBefore?: number
  /** Limit number of results */
  limit?: number
  /** Offset for pagination */
  offset?: number
}

/**
 * Type guard for successful enqueue result.
 */
export function isEnqueueSuccess<TEvent>(
  result: EnqueueResult<TEvent>,
): result is EnqueueSuccess<TEvent> {
  return result.ok
}

/**
 * Type guard for failed enqueue result.
 */
export function isEnqueueFailure<TEvent>(result: EnqueueResult<TEvent>): result is EnqueueFailure {
  return !result.ok
}

/**
 * Check if command is in a terminal state.
 */
export function isTerminalStatus(status: CommandStatus): boolean {
  return status === 'succeeded' || status === 'failed' || status === 'cancelled'
}
