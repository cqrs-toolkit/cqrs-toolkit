/**
 * Domain layer contract types.
 * The domain layer is consumer-provided, not library-provided.
 */

import { assert, generateId } from '#utils'
import { Err, Exception, type Link, Ok, type Result } from '@meticoeus/ddd-es'
import type { CacheKeyIdentity } from '../core/cache-manager/CacheKey.js'
import type { IAnticipatedEvent } from '../core/command-lifecycle/AnticipatedEventShape.js'
import type { IQueryManager } from '../core/query-manager/types.js'
import { AggregateConfig, type IdReference, ResponseIdReference } from './aggregates.js'
import {
  type CommandRecord,
  ConflictException,
  type EnqueueCommand,
  type FailureCategory,
  type FailureMapper,
  type HandlerCommand,
  type HandlerState,
} from './commands.js'
import { createEntityRef, type EntityId, type EntityRef } from './entities.js'
import type { JSONPathExpression } from './json-path.js'
import { ValidationError, ValidationException } from './validation.js'

/**
 * Post-processing plan for after server confirmation.
 * Used for temp ID replacement, cleanup, etc.
 */
export interface PostProcessPlan {
  /** Plan type identifier */
  kind: string
  /** Mapping of temporary IDs to field paths in event data */
  tempIds?: Record<string, string>
}

// ---------------------------------------------------------------------------
// Auto-revision marker
// ---------------------------------------------------------------------------

/**
 * Serializable sentinel that tells the library to automatically fill in the
 * correct revision for this command.
 *
 * Resolution order:
 * 1. If there are pending commands in the aggregate chain: use the revision
 *    from the last command's response (`nextExpectedRevision`).
 * 2. Otherwise: use `fallback` (the read model revision the consumer is looking at).
 *
 * Must survive JSON.stringify (SQLite storage) and structuredClone (postMessage
 * for worker modes). Types enforce immutability at compile time.
 */
export interface AutoRevision {
  readonly __autoRevision: true
  readonly fallback?: string
}

/**
 * Create an auto-revision marker with an optional fallback revision.
 *
 * @param fallback - The current revision from the read model. Used when no
 *   pending commands exist for this aggregate. Typically `item.latestRevision`.
 */
export function autoRevision(fallback?: string): AutoRevision {
  return { __autoRevision: true, fallback }
}

export function isAutoRevision(value: unknown): value is AutoRevision {
  return (
    typeof value === 'object' &&
    value !== null &&
    '__autoRevision' in value &&
    value.__autoRevision === true
  )
}

// ---------------------------------------------------------------------------
// Create command configuration
// ---------------------------------------------------------------------------

/**
 * Configuration for commands that create new aggregates.
 */
export interface CreateCommandConfig {
  /** Event type in the response to read the server-assigned ID from (data.id). */
  eventType: string
  /** Whether the client-generated ID is temporary (server replaces it) or permanent. */
  idStrategy: 'temporary' | 'permanent'
}

/**
 * The domain executor received a command type with no registered handler.
 */
export class UnknownCommandException extends Exception {
  readonly commandType: string

  constructor(commandType: string) {
    super('UnknownCommand', `Unknown command type: ${commandType}`)
    this.commandType = commandType
  }
}

export function isUnknownCommand(e: unknown): e is UnknownCommandException {
  return typeof e === 'object' && e !== null && 'name' in e && e.name === 'UnknownCommand'
}

/**
 * Outcome of a domain handler invocation — a flat discriminated union over
 * the four cases the handler can produce. This replaces the prior
 * `Result<DomainExecutionSuccess, DomainExecutionError>` shape so each
 * outcome reads as a peer rather than nested error variants.
 *
 * - `'success'` — produced anticipated events (and optional post-process plan).
 * - `'validation-error'` — pre-handler structural / sync / async validation
 *   failed; the command is rejected at submit and not persisted.
 * - `'unknown-command'` — no registration for this command type. Rejected at
 *   submit. Bug-shaped on regenerate paths.
 * - `'conflict'` — the handler detected a state conflict (using
 *   `{ initial, current }`) and is signaling a categorized failure. The
 *   command persists with the carried `category` accessible to the queue
 *   and UI.
 *
 * `validate` keeps `Result<unknown, ValidationException>` — sync, no read-model access.
 * `validateAsync` widens to `Result<unknown, ValidationException | ConflictException>`
 * because it has `queryManager` access and is a natural place to detect conflicts
 * ("another entity already has this name"). Submit-time conflicts and validation errors
 * flow through the same submit `Err` path; the consumer discriminates via the exception
 * type if they care.
 */
export type DomainExecutionOutcome<TEvent> =
  | { kind: 'success'; events: TEvent[]; postProcessPlan?: PostProcessPlan }
  | { kind: 'validation-error'; exception: ValidationException }
  | { kind: 'unknown-command'; exception: UnknownCommandException }
  | { kind: 'conflict'; exception: ConflictException }

// ---------------------------------------------------------------------------
// Handler context
// ---------------------------------------------------------------------------

/**
 * Context for the first execution of a command handler.
 */
export interface InitializingContext {
  /** First execution for this command. */
  phase: 'initializing'
  /** The command ID. Used by createEntityId to build EntityRef. */
  commandId: string
  /** ID strategy from the creates config. Used by createEntityId to build EntityRef. */
  idStrategy?: 'temporary' | 'permanent'
}

/**
 * Context for re-execution after dependency data changed (e.g., parent ID resolved).
 */
export interface UpdatingContext {
  /** Re-execution after dependency data changed. */
  phase: 'updating'
  /** The entity ID established during initial execution. Create handlers should reuse this
   *  instead of generating a new ID. */
  entityId: string
  /** The command ID. Used by createEntityId to build EntityRef. */
  commandId: string
  /** ID strategy from the creates config. Used by createEntityId to build EntityRef. */
  idStrategy?: 'temporary' | 'permanent'
}

/**
 * Context passed to command handlers.
 *
 * Discriminated union on `phase`. During `'updating'`, `entityId` is always present —
 * create handlers use it to preserve identity stability across regeneration.
 */
export type HandlerContext = InitializingContext | UpdatingContext

/**
 * Generate or reuse an entity ID based on handler context.
 *
 * For create commands with `idStrategy: 'temporary'`, returns an EntityRef carrying
 * lifecycle metadata (commandId, idStrategy). For permanent IDs or non-create commands,
 * returns a plain string.
 *
 * During regeneration, reuses the entity ID from the original execution.
 *
 * @param context - The handler context
 * @returns An EntityId (EntityRef for temporary creates, string otherwise)
 */
export function createEntityId(context: HandlerContext): EntityId {
  if (context.phase === 'initializing') {
    const id = generateId()
    if (context.idStrategy === 'temporary') {
      return createEntityRef(id, context.commandId, 'temporary')
    }
    return id
  }
  // Updating phase — reuse existing entity ID
  if (context.idStrategy === 'temporary') {
    return createEntityRef(context.entityId, context.commandId, 'temporary')
  }
  return context.entityId
}

// ---------------------------------------------------------------------------
// Async validation context
// ---------------------------------------------------------------------------

/**
 * Context provided to `validateAsync` handlers.
 * Gives access to the local read model for business rule checks
 * (name uniqueness, permission lookups, etc.).
 */
export interface AsyncValidationContext<TLink extends Link> {
  /** Query the local read model store. */
  queryManager: IQueryManager<TLink>
}

/**
 * Minimum command envelope shape for the domain executor dispatch layer.
 * Extends HandlerCommand (what the handler receives) with no additional fields —
 * exists as a named type for the executor's public API. Uses `unknown` for data
 * since the executor dispatches to type-specific handlers.
 */
export type ExecutorCommand = HandlerCommand

/**
 * Domain executor interface.
 *
 * Provides separate validation and handler phases so the CommandQueue can
 * transform data between them (e.g., re-injecting EntityRef values after
 * validation but before the handler runs).
 *
 * @template TEvent - Event type produced by the executor
 */
export interface IDomainExecutor<
  TLink extends Link,
  TCommand extends EnqueueCommand,
  TSchema,
  TEvent extends IAnticipatedEvent,
> {
  /**
   * Run validation phases (schema, validate, validateAsync) on the command data.
   * Returns the validated/hydrated data on success, or a validation error.
   *
   * Does NOT run the handler. Validation is binary (succeeded with hydrated
   * data, or failed); the algebraic outcome shape only applies at the handler
   * boundary where 3+ outcomes are legitimately distinct.
   */
  validate(
    command: ExecutorCommand,
    state: HandlerState,
  ): Promise<Result<unknown, ValidationException | UnknownCommandException | ConflictException>>

  /**
   * Run the handler only. No validation.
   * Produces anticipated events, a conflict signal, or an executor-level
   * error from the (possibly transformed) command data.
   *
   * @param command - The command envelope with data ready for the handler
   * @param state   - {@link HandlerState} carrying `initial` (submit-time snapshot)
   *                  and `current` (post-server-event view on regenerate)
   * @param context - Execution context (phase and entity ID for regeneration)
   * @returns A {@link DomainExecutionOutcome} discriminated on `kind`.
   */
  handle(
    command: ExecutorCommand,
    state: HandlerState,
    context: HandlerContext,
  ): DomainExecutionOutcome<TEvent>

  getRegistration(
    commandType: string,
  ): CommandHandlerRegistration<TLink, TCommand, TSchema, TEvent> | undefined
}

/**
 * Type guard for the success variant of a domain execution outcome.
 *
 * Discriminator-based narrowing (`if (outcome.kind === 'success')`) is the
 * idiomatic dispatch; this predicate is shipped for symmetry with existing
 * `is*` helpers and for use in array filters where inline narrowing is awkward.
 */
export function isDomainSuccess<TEvent>(
  outcome: DomainExecutionOutcome<TEvent>,
): outcome is { kind: 'success'; events: TEvent[]; postProcessPlan?: PostProcessPlan } {
  return outcome.kind === 'success'
}

/**
 * Helper to create a `'success'` outcome.
 */
export function domainSuccess<TEvent>(
  events: TEvent[],
  postProcessPlan?: PostProcessPlan,
): DomainExecutionOutcome<TEvent> {
  return { kind: 'success', events, postProcessPlan }
}

/**
 * Helper to create a `'validation-error'` outcome from one or more
 * `ValidationError` records.
 */
export function domainValidationError<TEvent>(
  errors: ValidationError[],
): DomainExecutionOutcome<TEvent> {
  return { kind: 'validation-error', exception: new ValidationException(errors) }
}

/**
 * Helper to create an `'unknown-command'` outcome.
 */
export function domainUnknownCommand<TEvent>(commandType: string): DomainExecutionOutcome<TEvent> {
  return { kind: 'unknown-command', exception: new UnknownCommandException(commandType) }
}

/**
 * Helper to create a `'conflict'` outcome carrying a {@link FailureCategory}.
 *
 * Use when the handler detects (via `{ initial, current }`) that the command
 * cannot proceed cleanly against the current state — a server change rendered
 * the user's edit invalid, the user's intent is already satisfied, etc.
 */
export function domainConflict<TEvent>(args: {
  message: string
  category: FailureCategory
  errorCode?: string
  details?: unknown
}): DomainExecutionOutcome<TEvent> {
  return { kind: 'conflict', exception: new ConflictException(args) }
}

// ---------------------------------------------------------------------------
// Schema validation
// ---------------------------------------------------------------------------

/**
 * Pluggable schema validator.
 *
 * Consumer provides a single implementation that knows how to validate their
 * chosen schema type (JSON Schema via AJV, Zod, etc.). Configured once on
 * `CqrsConfig.schemaValidator`.
 *
 * Each validation phase that succeeds may transform the data (coercion,
 * normalization). The transformed output replaces the command data for
 * subsequent phases and is persisted to `CommandRecord.data`.
 */
export interface SchemaValidator<TSchema> {
  validate(schema: TSchema, data: unknown): Result<unknown, ValidationException>
}

// ---------------------------------------------------------------------------
// Registration-based domain executor
// ---------------------------------------------------------------------------

/**
 * Wrapper passed to {@link CommandHandlerRegistration.classifyDependency}
 * carrying a command record and its events at evaluation time.
 *
 * The `events` array contains:
 * - For a still-pending / sending / cancelled-before-send / failed-at-server
 *   command: the anticipated events generated at enqueue (cached until the
 *   cascade evaluates).
 * - For a succeeded command: its persisted server events.
 * - For a command that never persisted (submit-time validation or handler
 *   rejection): an empty array.
 *
 * `CommandRecord` itself carries `serverResponse?` but not events, which is
 * why a wrapper is necessary.
 */
export interface ClassifierInput<
  TLink extends Link,
  TCommand extends EnqueueCommand,
  TEvent extends IAnticipatedEvent,
> {
  command: CommandRecord<TLink, TCommand>
  events: TEvent[]
}

/**
 * Registration for a single command handler.
 *
 * Command handling pipeline (all phases except `handler` are optional):
 *
 * 1. `schema` — structural validation via the configured `SchemaValidator`.
 *    The library calls the validator automatically. No consumer code needed.
 * 2. `validate` — custom sync validation for rules the schema can't express
 *    (cross-field constraints, enum membership, etc.). Like `zod.refine()`.
 * 3. `handler` — event generation from validated data. Will be migrated to
 *    `generateEvents` in a future phase.
 *
 * Phases 1-2 only run on initial execution (`'initializing'`), not on
 * regeneration (`'updating'`). Each phase may transform the data; the
 * transformed output is passed to subsequent phases and persisted.
 *
 * Schema validation is opt-in. Consumers can validate in their own UI forms
 * before submitting, use the `validate` step, or rely on schema validation.
 *
 * Distributive conditional type: when TCommand is a union, each member produces
 * its own registration variant with `commandType` and `handler(data)` correctly paired.
 *
 * @template TEvent - Anticipated event type produced by the handler.
 * @template TSchema - Schema type for structural validation (JSONSchema7, z.ZodType, etc.).
 */
export type CommandHandlerRegistration<
  TLink extends Link,
  TCommand extends EnqueueCommand = EnqueueCommand,
  TSchema = unknown,
  TEvent extends IAnticipatedEvent = IAnticipatedEvent,
> = TCommand extends infer C extends EnqueueCommand
  ? {
      /** Command type this handler processes */
      readonly commandType: C['type']
      readonly aggregate?: AggregateConfig<TLink>
      /** Phase 1: structural schema validation (library-driven). */
      readonly schema?: TSchema
      /** Phase 2: custom sync validation for rules the schema can't cover. */
      validate?(data: unknown, state: HandlerState): Result<unknown, ValidationException>
      /** Phase 3: async validation querying local data (permissions, name conflicts, etc.). */
      /** Phase 3: async validation querying local data (permissions, name conflicts, etc.).
       *  May return `ConflictException` when the local read model surfaces a true conflict
       *  (e.g. another entity already has the requested name). Submit-time conflicts and
       *  validation errors flow through the same `Err` path on `submit()` — consumers
       *  discriminate via `isConflict(err)` / `isValidationException(err)` if they care. */
      validateAsync?(
        command: C,
        state: HandlerState,
        context: AsyncValidationContext<TLink>,
      ): Promise<Result<unknown, ValidationException | ConflictException>>
      /** Phase 4: produce anticipated events, signal a conflict, or surface an
       *  executor-level error from validated data. Returns a discriminated
       *  {@link DomainExecutionOutcome} on `kind`. */
      handler(
        command: HandlerCommand<C['data'], C['path']>,
        state: HandlerState,
        context: HandlerContext,
      ): DomainExecutionOutcome<TEvent>
      /**
       * Per-command pluggable mapping from {@link ServerErrorResponse} to
       * {@link FailureDescriptor}. When defined, this is the **sole arbiter**
       * for the command type's response — the library does not fall back to
       * `CqrsConfig.mapFailure`. A consumer wanting global behaviour for
       * non-special cases imports the global function reference and calls
       * it explicitly inside this callback.
       */
      mapFailure?: FailureMapper
      /**
       * Classify an `'aggregate-chain'` dependency edge as `'hard'` or `'soft'`
       * at cascade decision time. Consulted only when the dependency edge's
       * `source` is `'aggregate-chain'`; entries with source `'entity-ref'` or
       * `'explicit'` short-circuit to hard and skip this callback entirely.
       *
       * Default when not registered: `'soft'`. The server then arbitrates —
       * misclassifying a real hard as soft costs N server rejections, which
       * is loud and recoverable. The opposite (silent over-cancel) is the
       * failure mode this callback exists to avoid.
       *
       * Evaluated at the moment a cascade decision is needed; results are
       * not stored. Throws propagate (consistent with the other consumer
       * callbacks on this registration); a throw halts the cascade walk.
       *
       * Declared as a method (not a property arrow) so per-variant parameter
       * narrowing on `C` survives method-parameter bivariance — same trick
       * the `handler` callback uses on the same registration. Without that,
       * narrow `C` in parameter position breaks the registration's flow
       * through executor factories that are generic in TCommand/TEvent.
       *
       * `events` arrays carry {@link IAnticipatedEvent} at the static type;
       * the consumer can cast or narrow at runtime if they need event-shape
       * specificity. Keeping events at the broad shape decouples the field's
       * variance from the registration's TEvent.
       *
       * @param myCommand This registration's command — statically narrowed
       *   to records of this registration's command type (`C`).
       * @param dependsOnCommand The upstream A — may be any registered
       *   command type, typed broadly. Narrow with a runtime check on
       *   `dependsOnCommand.command.type` if specific upstream data matters.
       *
       * See ADR-0009 (client) for the full alternatives narrative — including
       * why declarative state-preconditions, async classification, and
       * property-arrow signatures were tried and rejected.
       */
      classifyDependency?(
        myCommand: ClassifierInput<TLink, C, IAnticipatedEvent>,
        dependsOnCommand: ClassifierInput<TLink, EnqueueCommand, IAnticipatedEvent>,
      ): 'hard' | 'soft'
      /** If this command creates a new aggregate, configure how to extract the server ID. */
      readonly creates?: CreateCommandConfig
      /**
       * Declarative id mapping: paths into the command response that point to the server-assigned
       * id(s) — and optionally the next expected revision — of aggregate(s) this command touched.
       * Each entry pairs an id JSONPath with an aggregate config (or array for union links) and
       * may include a `revisionPath` for per-aggregate revision tracking. Evaluated at command
       * success to dual-index aggregate chains (client streamId ↔ server streamId), populate the
       * id mapping cache, and update each chain's `lastKnownRevision`.
       *
       * When neither `responseIdReferences` nor `responseIdMapping` is provided and `aggregate` is
       * set, `resolveConfig` auto-populates this with
       * `[{ aggregate, path: '$.id', revisionPath: '$.nextExpectedRevision' }]`. Once either is
       * explicitly provided, all id-mapping and revision-tracking behavior becomes the consumer's
       * responsibility (useful for complex commands that may not have a single primary aggregate).
       */
      readonly responseIdReferences?: ResponseIdReference<TLink>[]
      /**
       * Callback id mapping: compute EntityRef → serverId mappings (with optional next revision)
       * from arbitrary response shape. Use when `responseIdReferences` can't express the mapping
       * (computed ids, response events, multi-step logic). Receives the full command record and
       * response body.
       */
      responseIdMapping?(ctx: {
        command: CommandRecord<TLink, C>
        response: unknown
      }): Array<{ clientId: EntityRef; serverId: string; nextExpectedRevision?: string }>
      /**
       * Explicit declaration of every id location in the command and the aggregate
       * it belongs to. Paths are rooted at the command object: `$.data.foo`,
       * `$.path.bar`. Uses [*] for array wildcard. Use `[]` for commands that
       * reference no aggregate ids. Example:
       * `[{ aggregate: Note, path: '$.data.id' }, { aggregate: Folder, path: '$.data.parentId' }]`.
       *
       * Cross-aggregate parent references flow through this config too. The
       * producing create command is identified per-value by `EntityRef.commandId`
       * on the EntityRef at the declared path, which the pipeline reads to
       * auto-wire `dependsOn` and to rewrite ids on reconcile.
       */
      readonly commandIdReferences: IdReference<TLink>[]
      /**
       * Custom cache key resolver for complex commands where default resolution
       * (replace single field) is insufficient.
       *
       * Called during cache key reconciliation when this command succeeds with
       * a temporary ID mapping. Receives the command context and the current
       * cache key identity — returns the updated identity (same `.key`, updated fields).
       *
       * Omit for the common case: the library auto-resolves entity `link.id`
       * or scope `scopeParams` values from the id mapping.
       */
      resolveCacheKey?(params: {
        commandId: string
        type: string
        data: unknown
        serverResponse: unknown
        cacheKey: CacheKeyIdentity<TLink>
      }): CacheKeyIdentity<TLink>
    }
  : never

/**
 * Metadata lookup for command handler registrations.
 * Allows the CommandQueue to access creates config by command type.
 */
export interface ICommandHandlerMetadata<
  TLink extends Link,
  TCommand extends EnqueueCommand = EnqueueCommand,
  TSchema = unknown,
  TEvent extends IAnticipatedEvent = IAnticipatedEvent,
> {
  getRegistration(
    commandType: string,
  ): CommandHandlerRegistration<TLink, TCommand, TSchema, TEvent> | undefined
}

/**
 * Apply library defaults to a command handler registration and validate config.
 *
 * Defaults: auto-populates `responseIdReferences` with `[{ aggregate, path: '$.id' }]`
 * when the consumer declared neither `responseIdReferences` nor `responseIdMapping`
 * and the registration names its primary `aggregate`. Once either id-mapping config
 * is explicitly provided, no defaults are injected — the consumer owns the behavior.
 *
 * Validation: asserts every `commandIdReferences` path is rooted at `$.data`,
 * `$.path`, or `$.headers`.
 */
export function applyCommandHandlerDefaults<
  TLink extends Link,
  TCommand extends EnqueueCommand,
  TSchema,
  TEvent extends IAnticipatedEvent,
>(
  registration: CommandHandlerRegistration<TLink, TCommand, TSchema, TEvent>,
): CommandHandlerRegistration<TLink, TCommand, TSchema, TEvent> {
  assert(
    registration.aggregate !== undefined,
    `Command "${registration.commandType}" must declare an aggregate. ` +
      `Every command handler registration requires an explicit aggregate until ` +
      `aggregate-less commands are supported.`,
  )

  if (registration.commandIdReferences) {
    validateCommandIdReferencePaths(registration.commandType, registration.commandIdReferences)
  }

  if (
    registration.responseIdReferences !== undefined ||
    registration.responseIdMapping !== undefined
  ) {
    return registration
  }
  if (!registration.aggregate) return registration
  return {
    ...registration,
    responseIdReferences: [
      {
        aggregate: registration.aggregate,
        path: '$.id',
        revisionPath: '$.nextExpectedRevision',
      },
    ],
  }
}

const VALID_COMMAND_PATH_ROOTS = new Set(['data', 'path', 'headers'])

function extractPathRoot(path: JSONPathExpression): string {
  if (path.startsWith('$.')) {
    const rest = path.slice(2)
    const end = rest.search(/[.\[]/)
    return end === -1 ? rest : rest.slice(0, end)
  }
  if (path.startsWith('$[')) {
    const match = path.match(/^\$\[['"](\w+)['"]\]/)
    if (match?.[1]) return match[1]
  }
  return ''
}

function validateCommandIdReferencePaths<TLink extends Link>(
  commandType: string,
  refs: readonly IdReference<TLink>[],
): void {
  for (const ref of refs) {
    const root = extractPathRoot(ref.path)
    assert(
      VALID_COMMAND_PATH_ROOTS.has(root),
      `Command "${commandType}" has invalid commandIdReference path "${ref.path}": ` +
        `root segment must be "data", "path", or "headers", got "${root}"`,
    )
  }
}

/**
 * Options for `createDomainExecutor`.
 */
export interface CreateDomainExecutorOptions<TLink extends Link, TSchema = unknown> {
  /** Schema validator implementation. Required if any registration has a `schema`. */
  schemaValidator?: SchemaValidator<TSchema>
  /** Query manager for async validation phase. Required if any registration has `validateAsync`. */
  queryManager?: IQueryManager<TLink>
}

/**
 * Create a domain executor from an array of command handler registrations.
 *
 * Builds an internal lookup map for O(1) dispatch.
 * Asserts no duplicate command types — a duplicate means a config wiring bug.
 * Unknown command types at runtime return a validation failure.
 */
export function createDomainExecutor<
  TLink extends Link,
  TCommand extends EnqueueCommand,
  TSchema,
  TEvent extends IAnticipatedEvent,
>(
  registrations: CommandHandlerRegistration<TLink, TCommand, TSchema, TEvent>[],
  options?: CreateDomainExecutorOptions<TLink, TSchema>,
): IDomainExecutor<TLink, TCommand, TSchema, TEvent> {
  const registrationMap = new Map<
    string,
    CommandHandlerRegistration<TLink, TCommand, TSchema, TEvent>
  >()
  const schemaValidator = options?.schemaValidator
  const queryManager = options?.queryManager

  for (const reg of registrations) {
    assert(
      !registrationMap.has(reg.commandType),
      `Duplicate command handler registration for "${reg.commandType}"`,
    )
    registrationMap.set(reg.commandType, applyCommandHandlerDefaults(reg))
  }

  return {
    async validate(
      command: ExecutorCommand,
      state: HandlerState,
    ): Promise<Result<unknown, ValidationException | UnknownCommandException | ConflictException>> {
      const { type, data } = command
      const reg = registrationMap.get(type)
      if (!reg) {
        return Err(new UnknownCommandException(type))
      }

      let currentData = data

      // Phase 1: schema validation
      if (reg.schema !== undefined && schemaValidator) {
        const schemaResult = schemaValidator.validate(reg.schema, currentData)
        if (!schemaResult.ok) return schemaResult
        currentData = schemaResult.value
      }

      // Phase 2: custom sync validation
      if (reg.validate) {
        const validateResult = reg.validate(currentData, state)
        if (!validateResult.ok) return validateResult
        currentData = validateResult.value
      }

      // Phase 3: async validation (queries local read model)
      if (reg.validateAsync && queryManager) {
        const asyncResult = await reg.validateAsync(
          { ...command, data: currentData } as TCommand,
          state,
          {
            queryManager,
          },
        )
        if (!asyncResult.ok) return asyncResult
        currentData = asyncResult.value
      }

      return Ok(currentData)
    },

    handle(
      command: ExecutorCommand,
      state: HandlerState,
      context: HandlerContext,
    ): DomainExecutionOutcome<TEvent> {
      const reg = registrationMap.get(command.type)
      if (!reg) {
        return domainUnknownCommand<TEvent>(command.type)
      }
      return reg.handler({ ...command, data: command.data } as TCommand, state, context)
    },

    getRegistration(
      commandType: string,
    ): CommandHandlerRegistration<TLink, TCommand, TSchema, TEvent> | undefined {
      return registrationMap.get(commandType)
    },
  }
}
