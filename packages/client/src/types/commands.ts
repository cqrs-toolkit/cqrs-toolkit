/**
 * Command types for the CQRS Client command queue.
 */

import {
  type ErrResult,
  Exception,
  type IException,
  type Link,
  type OkResult,
  type Result,
} from '@meticoeus/ddd-es'
import type { CacheKeyIdentity } from '../core/cache-manager/CacheKey.js'
import type { AffectedAggregate } from './aggregates.js'
import type {
  AutoRevision,
  CreateCommandConfig,
  DomainExecutionError,
  PostProcessPlan,
} from './domain.js'
import { type EntityRef } from './entities.js'
import type { JSONPathExpression } from './json-path.js'
import { ValidationError, ValidationException } from './validation.js'

/**
 * Command lifecycle status.
 *
 * `'applied'` is **post-terminal** — it is not part of {@link TerminalCommandStatus}.
 * A command reaches `'applied'` after its effects are reflected in `serverData`,
 * which the sync pipeline establishes by observing either the command's response
 * events or per-aggregate revision/eviction coverage.
 */
export type CommandStatus =
  | 'pending' // Queued, not yet processed
  | 'blocked' // Waiting on dependencies
  | 'sending' // In-flight to server
  | 'succeeded' // Server confirmed, effects not yet reflected in serverData
  | 'applied' // Effects reflected in serverData (pipeline-owned transition)
  | 'failed' // Failed (local validation or server error)
  | 'cancelled' // User cancelled

/**
 * Error source - where the error originated.
 */
export type CommandErrorSource = 'local' | 'server'

/**
 * The requested command does not exist in storage.
 */
export class CommandNotFoundException extends Exception {
  readonly commandId: string

  constructor(commandId: string) {
    super('CommandNotFound', `Command not found: ${commandId}`)
    this.commandId = commandId
  }
}

export function isCommandNotFound(e: unknown): e is CommandNotFoundException {
  return typeof e === 'object' && e !== null && 'name' in e && e.name === 'CommandNotFound'
}

/**
 * The command's current status does not allow the requested operation.
 */
export class InvalidCommandStatusException extends Exception<{ status: CommandStatus }> {
  constructor(message: string, status: CommandStatus) {
    super('InvalidCommandStatus', message)
    this._details = { status }
  }
}

export function isInvalidCommandStatus(e: unknown): e is InvalidCommandStatusException {
  return typeof e === 'object' && e !== null && 'name' in e && e.name === 'InvalidCommandStatus'
}

/**
 * Details carried by a CommandFailedException.
 */
export interface CommandFailedDetails {
  source: CommandErrorSource
  errorCode?: string
  validationErrors?: ValidationError[]
  details?: unknown
}

/**
 * A command failed during processing (server rejection, validation, or local error).
 */
export class CommandFailedException extends Exception<CommandFailedDetails> {
  readonly errorCode?: string

  constructor(
    source: CommandErrorSource,
    message: string,
    opts?: Omit<CommandFailedDetails, 'source'>,
  ) {
    super('CommandFailed', message)
    this.errorCode = opts?.errorCode
    this._details = {
      source,
      errorCode: opts?.errorCode,
      validationErrors: opts?.validationErrors,
      details: opts?.details,
    }
  }
}

export function isCommandFailed(e: unknown): e is CommandFailedException {
  return typeof e === 'object' && e !== null && 'name' in e && e.name === 'CommandFailed'
}

/**
 * A command was cancelled before completion.
 */
export class CommandCancelledException extends Exception {
  constructor() {
    super('CommandCancelled', 'Command was cancelled')
  }
}

export function isCommandCancelled(e: unknown): e is CommandCancelledException {
  return typeof e === 'object' && e !== null && 'name' in e && e.name === 'CommandCancelled'
}

/**
 * Waiting for command completion timed out.
 */
export class CommandTimeoutException extends Exception {
  constructor() {
    super('CommandTimeout', 'Command timed out')
  }
}

export function isCommandTimeout(e: unknown): e is CommandTimeoutException {
  return typeof e === 'object' && e !== null && 'name' in e && e.name === 'CommandTimeout'
}

/**
 * Union of all command completion failure types.
 */
export type CommandCompletionError =
  | CommandFailedException
  | CommandCancelledException
  | CommandTimeoutException

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
  error?: IException
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
  /** Read model snapshot the user had when the command was submitted. Used by anticipated event processors as input state. */
  modelState?: unknown
  /** Aggregates affected by this command's anticipated events, derived at enqueue time.
   *  Each entry carries the canonical streamId (the chain/concurrency key from the
   *  event) and the EntityId-aware TLink for reconciliation across EntityRef lifecycles. */
  affectedAggregates?: AffectedAggregate<TLink>[]
  /** Resolved paths to EntityRef (or EntityTLink for Link-shaped fields) values in the
   *  command record, captured at enqueue time. Keyed by JSONPath rooted at the command
   *  object (e.g. `$.data.notebookId`, `$.path.id`). Used to strip/restore EntityRefs
   *  for storage and handler re-runs, derive auto-dependencies from `ref.commandId`,
   *  and prune entries as tempIds resolve to serverIds. */
  // TODO: widen to Record<JSONPathExpression, EntityRef | EntityTLink<TLink>> when A.4 (Link-aware walker) lands
  commandIdPaths?: Record<JSONPathExpression, EntityRef>
  /**
   * Pipeline coverage tracking for the `'succeeded' → 'applied'` transition. Populated
   * by the CommandQueue success path; consumed + updated by the server data pipeline.
   *
   * JSON-encoded on-disk. After parse:
   *   - `'events'` — server response carried events; rule 1 (pipeline drain of those
   *     events) will mark the command applied.
   *   - `Record<streamId, stringifiedBigInt>` — server response carried no events;
   *     rule 2 (per-aggregate revision / cache-key eviction) removes entries as
   *     coverage accrues. Empty map → command transitions to `'applied'`.
   *
   * Absent for commands not yet in `'succeeded'` status. The pipeline's in-flight
   * filter on `'succeeded'` guarantees every in-scope command has this populated.
   * See `_active-plans/command-applied.md` §3.2.
   */
  pendingAggregateCoverage?: string
  /** Sequence number for stable submit-order sorting. Assigned by CommandStore;
   *  SQL autoincrement is authoritative on disk — this value is read-only from
   *  the storage perspective. */
  seq: number
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
  /** Path from the storage root (e.g. 'cqrs-client/uploads/{commandId}/{fileId}' for OPFS). */
  storagePath: string
  /** Optional integrity check (e.g. SHA-256 hex) */
  checksum?: string
  /** File data — undefined at rest, populated by the library before send(). */
  data?: Blob
}

/**
 * Command shape received by command handlers to produce anticipated events.
 * Contains the command identity, payload, and file metadata — but NOT File
 * blobs, revision, service, or dependency info (those are submit/send concerns).
 */
export interface HandlerCommand<TData = unknown> {
  /** Command type */
  type: string
  /** Command data (HTTP body payload) */
  data: TData
  /** URL path template values (e.g. `{ id: '...' }`). */
  path?: unknown
  /** File attachment metadata (library-populated from `files` at enqueue time).
   *  Available to handlers for producing anticipated events that reference file
   *  properties (filename, mimeType, etc.). */
  fileRefs?: FileRef[]
}

/**
 * Command to enqueue via `client.submit()`.
 * Extends the handler shape with submit-time concerns: File blobs, revision,
 * service routing, and dependency declarations.
 */
export interface EnqueueCommand<TData = unknown> extends HandlerCommand<TData> {
  /** File attachments for upload commands. Provide File objects (from input elements or `new File()`). */
  files?: File[]
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
  /**
   * Read-model snapshot at submission time, passed to the domain executor as
   * the handler's initial state. State-dependent anticipated event handlers
   * use this so the optimistic event reflects what the user saw when they
   * submitted.
   */
  modelState?: unknown
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
  /** EntityRef for the created entity, if this was a create command. */
  entityRef?: EntityRef
}

/**
 * Result of enqueue operation.
 */
export type EnqueueResult<TEvent> = Result<EnqueueSuccess<TEvent>, DomainExecutionError>

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
 * Error union for enqueueAndWait — enqueue validation or completion failure.
 */
export type EnqueueAndWaitError = DomainExecutionError | CommandCompletionError

/**
 * Result of enqueueAndWait operation.
 */
export type EnqueueAndWaitResult<TResponse> = Result<
  EnqueueAndWaitSuccess<TResponse>,
  EnqueueAndWaitError
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
  error?: IException
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
): result is ErrResult<ValidationException> {
  return !result.ok
}

/**
 * Terminal command statuses — command processing is complete.
 *
 * Note: `'applied'` is post-terminal and intentionally NOT included here.
 * Terminal status gates `waitForCompletion`, file cleanup, and chain detachment —
 * all of which fire at `'succeeded'` and must not wait for the pipeline's later
 * `'succeeded' → 'applied'` transition.
 */
export type TerminalCommandStatus = 'applied' | 'succeeded' | 'failed' | 'cancelled'

/**
 * Check if command is in a terminal state.
 *
 * 'applied' is questionable and needs to be handled carefully by callers.
 * The normal lifecycle is 'succeeded' -> 'applied' so naive treatment can double-effect.
 */
export function isTerminalStatus(status: CommandStatus): status is TerminalCommandStatus {
  switch (status) {
    case 'applied':
    case 'succeeded':
    case 'failed':
    case 'cancelled':
      return true
    default:
      return false
  }
}

/**
 * True for {@link CommandEvent}s that signal a command has finished all work —
 * including post-success processing (aggregate-id reconciliation, overlay
 * rewrites, dependent unblocking) and post-failure processing (dependent
 * cancellation).
 *
 * Distinct from {@link isTerminalStatus}: a `status-changed` {@link CommandEvent}
 * with a terminal {@link CommandEvent.status} fires at the status flip — BEFORE
 * post-processing. The terminal {@link CommandEvent.eventType}s (`completed`,
 * `failed`, `cancelled`) fire AFTER, so consumers that need to observe
 * fully-settled state (e.g. `waitForCompletion`) should filter on the
 * {@link CommandEvent.eventType} via this predicate rather than on status.
 */
export function isTerminalCommandEvent(event: CommandEvent): boolean {
  return (
    event.eventType === 'completed' ||
    event.eventType === 'failed' ||
    event.eventType === 'cancelled'
  )
}

/**
 * Check if a command has reached server confirmation — either `'succeeded'`
 * (server acked, local serverData may not yet reflect effects) or `'applied'`
 * (local serverData reflects effects).
 *
 * Use for completion-result branching where both statuses should resolve the
 * same `Ok(response)` outcome. Consumer-awaited promises resolve on `'succeeded'`;
 * if a consumer later inspects a command already in `'applied'`, treat it the same.
 */
export function isConfirmedStatus(status: CommandStatus): status is 'succeeded' | 'applied' {
  return status === 'succeeded' || status === 'applied'
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
  | { stage: 'enqueued'; commandId: string; entityRef?: EntityRef }
  | { stage: 'confirmed'; commandId: string; response: TResponse; entityRef?: EntityRef }

/**
 * Error union for submit — enqueue validation or completion failure.
 */
export type SubmitError = DomainExecutionError | CommandCompletionError

/**
 * Result of the network-aware submit operation.
 */
export type SubmitResult<TResponse> = Result<SubmitSuccess<TResponse>, SubmitError>
