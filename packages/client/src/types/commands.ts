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
  PostProcessPlan,
  UnknownCommandException,
} from './domain.js'
import { type EntityId, type EntityRef } from './entities.js'
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
 * Typed classification for a command failure. Drives retry, user-intervention,
 * and cancellation decisions in one place; UI consumers switch on this rather
 * than parsing status codes or matching `errorCode` strings.
 *
 * The union is **extensible** — new categories graduate as new behaviours
 * emerge. Adding a member is a single edit; the compiler enforces exhaustive
 * handling at every dispatch site.
 *
 * Distinctions:
 * - `'unauthenticated'` (re-auth fixes it) is intentionally distinct from
 *   `'permission-denied'` (re-auth does not).
 * - `'redundant'` is distinct from `'requires-review'` because nothing needs
 *   reviewing — the user's intent is already satisfied (duplicate edit,
 *   idempotent no-op).
 */
export type FailureCategory =
  | 'transient'
  | 'requires-review'
  | 'redundant'
  | 'unauthenticated'
  | 'permission-denied'
  | 'permanent'

/**
 * Parsed shape of an error response from the server, handed to a
 * {@link FailureMapper}. HTTP-shaped because that's the dominant transport;
 * non-HTTP senders may pass synthetic values where appropriate.
 */
export interface ServerErrorResponse {
  /** HTTP status code (RFC 9110 aligned). */
  status: number
  /** Response headers — for Retry-After-aware classification, content-type sniffing, etc. */
  headers: Headers
  /**
   * Parsed body if the sender parsed it (problem+json document, ld+json
   * document, or bespoke shape); raw text if parsing failed; undefined when
   * there is no body.
   */
  body: unknown
}

/**
 * Result of mapping a {@link ServerErrorResponse} (or a handler-detected
 * conflict) to library-actionable failure data.
 *
 * `category` is the primary axis of dispatch. `errorCode` is a stable
 * identifier for the specific failure kind (typically a problem+json `type`
 * URI, ld+json `@type`, or bespoke identifier) that the UI dispatches on for
 * sub-types beyond the broad category.
 */
export interface FailureDescriptor {
  /** Drives retry decision, lifecycle status routing, cascade behaviour, and UI signaling. */
  category: FailureCategory
  /** Stable identifier for the specific failure kind. */
  errorCode?: string
  /** Field-level validation errors when the response carries them. */
  validationErrors?: ValidationError[]
  /** Free-form payload for the UI; the library does not interpret. */
  details?: unknown
}

/**
 * Function shape for translating a server error response into a
 * {@link FailureDescriptor}. The library exports composable defaults
 * (`defaultStatusMapper`, `defaultProblemJsonMapper`, `defaultLdJsonMapper`).
 *
 * Resolution at the queue: per-command `mapFailure` on
 * `CommandHandlerRegistration` is the sole arbiter when defined (no automatic
 * cascade); otherwise the global `CqrsConfig.mapFailure` runs (defaulting to
 * `defaultProblemJsonMapper`). A consumer that wants the global's behaviour
 * for non-special cases imports the same function reference and calls it
 * explicitly.
 */
export type FailureMapper = (response: ServerErrorResponse) => FailureDescriptor

/**
 * Details carried by a CommandFailedException.
 */
export interface CommandFailedDetails {
  source: CommandErrorSource
  category: FailureCategory
  errorCode?: string
  validationErrors?: ValidationError[]
  details?: unknown
}

/**
 * A command failed during processing (server rejection, validation, or local error).
 *
 * Carries a {@link FailureCategory} so consumers dispatch on a typed axis
 * rather than parsing status codes or matching `errorCode` strings.
 */
export class CommandFailedException extends Exception<CommandFailedDetails> {
  readonly category: FailureCategory
  readonly errorCode?: string

  constructor(
    source: CommandErrorSource,
    message: string,
    opts: Omit<CommandFailedDetails, 'source'>,
  ) {
    super('CommandFailed', message)
    this.category = opts.category
    this.errorCode = opts.errorCode
    this._details = {
      source,
      category: opts.category,
      errorCode: opts.errorCode,
      validationErrors: opts.validationErrors,
      details: opts.details,
    }
  }
}

export function isCommandFailed(e: unknown): e is CommandFailedException {
  return typeof e === 'object' && e !== null && 'name' in e && e.name === 'CommandFailed'
}

/**
 * The handler detected that the command cannot proceed cleanly against the
 * current state — either the user's edit conflicts with a server change, or
 * the user's intent is already satisfied, or a precondition has shifted.
 *
 * Returned as the `'conflict'` variant of `DomainExecutionOutcome` (see
 * `types/domain.ts`). The library routes the carried `category` through the
 * same dispatch as server-derived failures.
 */
export class ConflictException extends Exception<{
  category: FailureCategory
  errorCode?: string
  details?: unknown
}> {
  readonly category: FailureCategory
  readonly errorCode?: string

  constructor(opts: {
    message: string
    category: FailureCategory
    errorCode?: string
    details?: unknown
  }) {
    super('Conflict', opts.message)
    this.category = opts.category
    this.errorCode = opts.errorCode
    this._details = {
      category: opts.category,
      errorCode: opts.errorCode,
      details: opts.details,
    }
  }
}

export function isConflict(e: unknown): e is ConflictException {
  return typeof e === 'object' && e !== null && 'name' in e && e.name === 'Conflict'
}

// ---------------------------------------------------------------------------
// Category predicates — typed checks that keep UI / queue code free of
// string comparisons. Each accepts any value with a category-bearing shape.
// ---------------------------------------------------------------------------

interface HasCategory {
  readonly category: FailureCategory
}

function hasCategory(e: unknown): e is HasCategory {
  if (typeof e !== 'object' || e === null) return false
  if (!('category' in e)) return false
  return typeof (e as { category: unknown }).category === 'string'
}

export function isTransient(e: unknown): e is HasCategory & { category: 'transient' } {
  return hasCategory(e) && e.category === 'transient'
}
export function requiresReview(e: unknown): e is HasCategory & { category: 'requires-review' } {
  return hasCategory(e) && e.category === 'requires-review'
}
export function isRedundant(e: unknown): e is HasCategory & { category: 'redundant' } {
  return hasCategory(e) && e.category === 'redundant'
}
export function isUnauthenticated(e: unknown): e is HasCategory & { category: 'unauthenticated' } {
  return hasCategory(e) && e.category === 'unauthenticated'
}
export function isPermissionDenied(
  e: unknown,
): e is HasCategory & { category: 'permission-denied' } {
  return hasCategory(e) && e.category === 'permission-denied'
}
export function isPermanent(e: unknown): e is HasCategory & { category: 'permanent' } {
  return hasCategory(e) && e.category === 'permanent'
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
 * Origin of a {@link CommandDependency} entry. Determines whether the cascade
 * walk consults the dependent's `classifyDependency` callback at decision time
 * or short-circuits to a known strength.
 *
 * - `'entity-ref'`: derived from an `EntityRef.commandId` at a path declared in
 *   `commandIdReferences`. Always **hard** — B's payload references an id A
 *   creates; if A doesn't land, B's reference has no meaning.
 * - `'explicit'`: caller wrote `dependsOn: [...]` at submit. Always **hard** —
 *   the caller has out-of-band domain knowledge that B requires A's effect.
 *   Soft same-aggregate ordering is expressed by *not* declaring the dep.
 * - `'aggregate-chain'`: auto-derived from same-aggregate ordering. The queue
 *   cannot decide hard vs soft on its own; the dependent's
 *   `classifyDependency` callback (if registered) decides; default is soft.
 */
export type DependencySource = 'entity-ref' | 'aggregate-chain' | 'explicit'

/**
 * A single edge in {@link CommandRecord.dependsOn}, tagged with the origin
 * that produced it. The `source` informs the cascade walk how to treat the
 * edge when the dependency reaches a non-success terminal status — see
 * {@link DependencySource}. Multiple origins for the same `commandId`
 * collapse to one entry under the strictest-strength rule:
 * `entity-ref > explicit > aggregate-chain`.
 */
export interface CommandDependency {
  commandId: string
  source: DependencySource
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
  /** Escape-hatch envelope headers — same shape as
   *  {@link HandlerCommand.headers}.
   *
   *  Stored with {@link EntityRef}s intact at declared positions; the cascade
   *  rewrites them in-place to server-id strings when the producing
   *  command resolves. By the time the command is dispatched to
   *  {@link ICommandSender.send} every value is a plain string. */
  headers?: Record<string, EntityId>
  /** Current status */
  status: CommandStatus
  /** Source-tagged dependencies this command must wait on. Each entry carries
   *  the upstream `commandId` and the {@link DependencySource origin} that
   *  produced it, which the cascade walk uses to decide whether a non-success
   *  terminal upstream propagates as a cancellation (hard) or simply unblocks
   *  this command for an independent attempt (soft). */
  dependsOn: CommandDependency[]
  /** Subset of `dependsOn` commandIds still gating this command — those that
   *  have not yet reached terminal status. Entries drop off as deps complete;
   *  when this list empties, status flips from 'blocked' to 'pending'.
   *
   *  Stored flat (no source tag) — the source for any entry here can be
   *  looked up by joining with the matching `dependsOn` record. */
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
  /** Read-model snapshot the user was operating against when the command was submitted.
   *  Captured at submit, persisted durably with the command record, and immutable thereafter.
   *  This becomes the `initial` half of the {@link HandlerState} the command-level handler
   *  functions (validate, validateAsync, handler) receive. Re-runs receive the post-server-event
   *  view as a separate `updated` companion (see {@link HandlerState}). */
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
 * Wire-shaped {@link CommandRecord} handed to {@link ICommandSender.send}.
 *
 * Identical to {@link CommandRecord} except {@link CommandRecord.headers} is
 * narrowed to `Record<string, string>`: by the time the queue invokes the
 * sender, the cascade has flattened every declared {@link EntityRef} header
 * to a server-id string and the queue asserts (via package-local `assert`)
 * that any remaining values are plain strings. Senders never see
 * `EntityRef`s — they never have to flatten.
 */
export type SendableCommandRecord<
  TLink extends Link,
  TCommand extends EnqueueCommand,
  TResponse = unknown,
> = Omit<CommandRecord<TLink, TCommand, TResponse>, 'headers'> & {
  headers?: Record<string, string>
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
 * Always-present fields of a handler command — split out so {@link HandlerCommand}
 * and {@link EnqueueCommand} can conditionally compose the `path` shape on
 * top without duplicating the rest.
 */
export interface HandlerCommandBase<TData = unknown> {
  /** Command type */
  type: string
  /** Command data (HTTP body payload) */
  data: TData
  /** Escape-hatch envelope headers.
   *
   *  Values may be plain strings or {@link EntityId} (string | {@link EntityRef}).
   *  EntityRef positions must be declared on the registration's
   *  `commandIdReferences` (e.g. `$.headers['x-tenant-id']`) so the queue
   *  auto-wires a `dependsOn` on the producing command and rewrites the
   *  temp id to the server id in place once the parent resolves.
   *
   *  Headers are not user-validated; they are not stripped at submit and
   *  the handler sees the same `EntityRef`s the consumer submitted. By
   *  send-time the cascade has flattened every declared {@link EntityRef}
   *  to a server-id string and the queue narrows the type to
   *  `Record<string, string>` for the sender. */
  headers?: Record<string, EntityId>
  /** File attachment metadata (library-populated from `files` at enqueue time).
   *  Available to handlers for producing anticipated events that reference file
   *  properties (filename, mimeType, etc.). */
  fileRefs?: FileRef[]
}

/**
 * Command shape received by command handlers to produce anticipated events.
 *
 * `TPath` controls the `path` requirement via a distributive conditional:
 *
 * - `TPath = unknown` (default, internal/queue usage) → `path?: unknown` open.
 * - `TPath = undefined` (consumer-side "no path" sentinel) → `path?: never`
 *   forbidden, catches passing a `path` to a command type that doesn't take one.
 * - `TPath = { id: EntityId }` (or any concrete shape) → `path: TPath` required.
 *
 * Inside a registration's `handler(command, ...)` callback, `TPath` is
 * inferred from the matched AppCommand union member at `domain.ts`'s
 * `HandlerCommand<C['data'], C['path']>`, so handlers for commands that
 * declare `path: { id: EntityId }` get required `path` automatically.
 */
export type HandlerCommand<TData = unknown, TPath = unknown> = HandlerCommandBase<TData> &
  ([TPath] extends [undefined]
    ? { path?: never }
    : unknown extends TPath
      ? { path?: unknown }
      : { path: TPath })

/**
 * Command to enqueue via `client.submit()`.
 *
 * Composed from {@link HandlerCommand} with submit-time fields appended:
 * File blobs, revision, service routing, dependency declarations. `TPath`
 * threads through the conditional in {@link HandlerCommand} unchanged.
 */
export type EnqueueCommand<TData = unknown, TPath = unknown> = HandlerCommand<TData, TPath> & {
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
   * Read-model snapshot the user was operating against at submission time.
   * Persisted durably on the command record and surfaced as the `initial`
   * half of {@link HandlerState} to validate / validateAsync / handler. On
   * reconciliation re-runs the queue computes a post-server-event `updated`
   * companion so a state-dependent handler can decide whether the user's
   * edit is still valid. Pass it whenever the command is being submitted
   * against an existing entity; omit when there is no relevant prior state
   * (e.g. a create against an unseeded collection).
   */
  modelState?: unknown
}

/**
 * Read-model state surfaced to command-level handler functions
 * (validate, validateAsync, handler).
 *
 * Discriminated union on `mode`:
 *
 * - `'initial'` — first invocation at enqueue. Only `initial` is meaningful;
 *   the handler produces optimistic anticipated events against what the user
 *   just submitted.
 * - `'regenerate'` — any subsequent invocation, regardless of trigger
 *   (server-event delta, id-rewrite cascade, AutoRevision resolution). The
 *   library always populates `current` with the latest read-model view of the
 *   command's primary entity so handler behavior is consistent across
 *   triggers — handlers don't have to special-case why they were re-invoked.
 *
 * `initial` is the consumer-supplied snapshot from submit, persisted durably
 * on the command record, constant for the command's lifetime.
 *
 * `current` is `T | undefined` because the entity may not be in the read
 * model store yet (e.g. a freshly-created entity whose anticipated events
 * haven't been folded yet, or an entity outside the active cache). Handlers
 * tolerate this the same way they did before the shape change — by
 * defaulting or branching when state is absent.
 *
 * Handlers that just want "the most current view available" can read
 * `state.mode === 'regenerate' ? (state.current ?? state.initial) : state.initial`.
 *
 * Note: this shape applies only to command-level functions. Event Processors
 * receive a single `state: TModel | undefined` since they're entity-level
 * reducers and the "what the user saw at submit" concept doesn't apply.
 */
export type HandlerState<T = unknown> =
  | {
      /** First invocation — produced at enqueue. */
      mode: 'initial'
      /** Snapshot the consumer passed at submit. */
      initial: T | undefined
    }
  | {
      /**
       * Any subsequent invocation. Trigger may be a server-event delta, an
       * id-rewrite cascade after a parent command succeeded, or AutoRevision
       * resolution — handlers don't distinguish.
       */
      mode: 'regenerate'
      /** Snapshot the consumer passed at submit. Unchanged from the first call. */
      initial: T | undefined
      /**
       * Latest read-model view of the command's primary entity at the moment of
       * regenerate. `undefined` only when the entity isn't yet in the read-model
       * store (no overlay folded yet, outside active cache, etc.) — not a
       * trigger-based signal.
       */
      current: T | undefined
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
 * Options for waitForSucceeded operation.
 */
export interface WaitOptions {
  /** Timeout in milliseconds (default: 30000) */
  timeout?: number
}

/**
 * Options for enqueueAndWait operation.
 */
export interface EnqueueAndWaitOptions<TLink extends Link>
  extends EnqueueOptions<TLink>, WaitOptions {
  /**
   * Terminal state to wait for. Default `'applied'` — the sync pipeline has
   * reflected the command's response events in the read model. Override with
   * `'succeeded'` to resolve earlier at server acknowledgement, before the
   * read-model drain completes.
   */
  waitFor?: 'succeeded' | 'applied'
}

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
 * Reasons the enqueue operation can fail.
 *
 * Validation failure (`ValidationException`) and missing handler registration
 * (`UnknownCommandException`) prevent the command from entering the queue.
 * Handler-returned `'conflict'` outcomes (`ConflictException`) currently flow
 * out the same path while the queue lacks a "persist as failed" routing —
 * task #13 will narrow this union back to validation/unknown when conflicts
 * are persisted instead of rejected.
 */
export type EnqueueRejection = ValidationException | UnknownCommandException | ConflictException

/**
 * Result of enqueue operation.
 */
export type EnqueueResult<TEvent> = Result<EnqueueSuccess<TEvent>, EnqueueRejection>

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
export type EnqueueAndWaitError = EnqueueRejection | CommandCompletionError

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
 * Terminal status gates `waitForSucceeded`, file cleanup, and chain detachment —
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
 * fully-settled state (e.g. `waitForSucceeded`) should filter on the
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
export type SubmitError = EnqueueRejection | CommandCompletionError

/**
 * Result of the network-aware submit operation.
 */
export type SubmitResult<TResponse> = Result<SubmitSuccess<TResponse>, SubmitError>
