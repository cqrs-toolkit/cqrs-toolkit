/**
 * Command types for the CQRS Client command queue.
 */

import {
  type ErrResult,
  Exception,
  type Link,
  type OkResult,
  type Result,
  ValidationException,
} from '@meticoeus/ddd-es'
import type { CacheKeyIdentity } from '../core/cache-manager/CacheKey.js'
import type { AutoRevision, CreateCommandConfig, PostProcessPlan } from './domain.js'
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
export interface CommandRecord<
  TLink extends Link,
  TCommand extends EnqueueCommand,
  TResponse = unknown,
> {
  /** Unique command identifier (client-generated) */
  commandId: string
  /** Cache key identity — associates this command's events with the correct data scope. Serialized as JSON in SQL storage. */
  cacheKey: CacheKeyIdentity<TLink>
  /** Target service for the command */
  service: string
  /** Command type (e.g., 'CreateTodo', 'UpdateUser') */
  type: TCommand['type']
  /** Command data */
  data: TCommand['data']
  /** URL path template values for command sender URL expansion. */
  path?: unknown
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
  /** Error information if failed */
  error?: CommandError
  /** Server response on success */
  serverResponse?: TResponse
  /** Post-processing instructions from the domain executor */
  postProcess?: PostProcessPlan
  /** Create command configuration (present only for commands that create aggregates) */
  creates?: CreateCommandConfig
  /** Revision for optimistic concurrency. AutoRevision markers are resolved before send. */
  revision?: string | AutoRevision
  /** File attachments — metadata at rest, hydrated with Blob data before send(). */
  fileRefs?: FileRef[]
  /** Creation timestamp */
  createdAt: number
  /** Last update timestamp */
  updatedAt: number
}

/**
 * Metadata for a file attached to a command.
 *
 * At rest (persisted): `data` is undefined — binary lives in OPFS or in-memory file store.
 * Before send: the library hydrates `data` with a Blob read from the file store.
 */
export interface FileRef {
  /** Unique file identifier (UUID) — used for OPFS path and per-file operations. */
  id: string
  /** Original filename */
  filename: string
  /** MIME type */
  mimeType: string
  /** File size in bytes */
  sizeBytes: number
  /** Optional integrity check (e.g. SHA-256 hex) */
  checksum?: string
  /** File data — undefined at rest, populated by the library before send(). */
  data?: Blob
}

/**
 * Command to enqueue.
 */
export interface EnqueueCommand<TData = unknown> {
  /** Command type */
  type: string
  /** Command data (HTTP body payload) */
  data: TData
  /** File attachments for upload commands. Provide File objects (from input elements or `new File()`). */
  files?: File[]
  /** URL path template values (e.g. `{ id: '...' }`). Used by the command sender for URL expansion. */
  path?: unknown
  /** Revision for optimistic concurrency (mutate commands). Absent for creates. */
  revision?: string | AutoRevision
  /** Target service (optional, defaults to primary) */
  service?: string
  /** Commands this depends on (optional) */
  dependsOn?: string[]
}

/**
 * Options for enqueue operation.
 */
export interface EnqueueOptions<TLink extends Link> {
  /** Skip local domain validation */
  skipValidation?: boolean
  /** Custom command ID (defaults to generated UUID) */
  commandId?: string
  /** Cache key identity — associates anticipated events and response events with the correct data scope. */
  cacheKey: CacheKeyIdentity<TLink>
}

/**
 * Parameters for {@link ICommandQueue.enqueue}.
 */
export interface EnqueueParams<TLink extends Link, TData = unknown> extends EnqueueOptions<TLink> {
  /** Command to enqueue */
  command: EnqueueCommand<TData>
  /** Pre-built file refs from the window-side proxy (internal — set by CommandQueueProxy, not consumers). */
  fileRefs?: FileRef[]
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
export interface EnqueueAndWaitOptions<TLink extends Link>
  extends EnqueueOptions<TLink>, WaitOptions {}

/**
 * Parameters for {@link ICommandQueue.enqueueAndWait}.
 */
export interface EnqueueAndWaitParams<
  TLink extends Link,
  TData = unknown,
> extends EnqueueAndWaitOptions<TLink> {
  /** Command to enqueue and wait for */
  command: EnqueueCommand<TData>
}

/**
 * Successful enqueue data.
 */
export interface EnqueueSuccess<TEvent> {
  /** Assigned command ID */
  commandId: string
  /** Anticipated events produced */
  anticipatedEvents: TEvent[]
}

/**
 * Result of enqueue operation.
 */
export type EnqueueResult<TEvent> = Result<
  EnqueueSuccess<TEvent>,
  ValidationException<ValidationError[]>
>

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
 * Successful enqueueAndWait data.
 */
export interface EnqueueAndWaitSuccess<TResponse> {
  /** Assigned command ID */
  commandId: string
  /** Server response */
  response: TResponse
}

/**
 * Exception for enqueueAndWait failures, carrying validation errors and their source.
 */
export class EnqueueAndWaitException extends Exception<{
  errors: ValidationError[]
  source: CommandErrorSource
}> {
  constructor(errors: ValidationError[], source: CommandErrorSource) {
    super('EnqueueAndWaitFailed', errors[0]?.message ?? 'Command failed')
    this._details = { errors, source }
  }
}

/**
 * Result of enqueueAndWait operation.
 */
export type EnqueueAndWaitResult<TResponse> = Result<
  EnqueueAndWaitSuccess<TResponse>,
  EnqueueAndWaitException
>

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
): result is OkResult<EnqueueSuccess<TEvent>> {
  return result.ok
}

/**
 * Type guard for failed enqueue result.
 */
export function isEnqueueFailure<TEvent>(
  result: EnqueueResult<TEvent>,
): result is ErrResult<ValidationException<ValidationError[]>> {
  return !result.ok
}

/**
 * Terminal command statuses — command processing is complete.
 */
export type TerminalCommandStatus = 'succeeded' | 'failed' | 'cancelled'

/**
 * Check if command is in a terminal state.
 */
export function isTerminalStatus(status: CommandStatus): status is TerminalCommandStatus {
  return status === 'succeeded' || status === 'failed' || status === 'cancelled'
}

// ---------------------------------------------------------------------------
// Network-aware submit types
// ---------------------------------------------------------------------------

/**
 * Options for the network-aware submit operation.
 */
export interface SubmitOptions<TLink extends Link> extends EnqueueOptions<TLink>, WaitOptions {}

/**
 * Parameters for {@link CqrsClient.submit}.
 */
export interface SubmitParams<
  TLink extends Link,
  TCommand extends EnqueueCommand = EnqueueCommand,
> extends SubmitOptions<TLink> {
  /** Command to submit */
  command: TCommand
}

/**
 * Successful submit result — discriminated by lifecycle stage.
 *
 * - `'enqueued'` — command persisted locally, server sync pending (offline or unauthenticated).
 * - `'confirmed'` — server acknowledged the command.
 */
export type SubmitSuccess<TResponse> =
  | { stage: 'enqueued'; commandId: string }
  | { stage: 'confirmed'; commandId: string; response: TResponse }

/**
 * Result of the network-aware submit operation.
 */
export type SubmitResult<TResponse> = Result<SubmitSuccess<TResponse>, SubmitException>

/**
 * Exception for submit failures.
 *
 * `details.commandId` is set when the command IS in the queue despite the error
 * (server rejection, timeout). The consumer can use it to retry or track.
 */
export class SubmitException extends Exception<{
  errors: ValidationError[]
  source: CommandErrorSource
  commandId?: string
}> {
  constructor(errors: ValidationError[], source: CommandErrorSource, commandId?: string) {
    super('SubmitFailed', errors[0]?.message ?? 'Command failed')
    this._details = { errors, source, commandId }
  }
}
