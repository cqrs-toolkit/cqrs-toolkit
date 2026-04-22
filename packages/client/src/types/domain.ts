/**
 * Domain layer contract types.
 * The domain layer is consumer-provided, not library-provided.
 */

import { assert, generateId } from '#utils'
import {
  Err,
  type ErrResult,
  Exception,
  type Link,
  Ok,
  type OkResult,
  type Result,
} from '@meticoeus/ddd-es'
import type { CacheKeyIdentity } from '../core/cache-manager/CacheKey.js'
import type { IAnticipatedEvent } from '../core/command-lifecycle/AnticipatedEventShape.js'
import type { IQueryManager } from '../core/query-manager/types.js'
import { AggregateConfig, type IdReference, ResponseIdReference } from './aggregates.js'
import type { CommandRecord, EnqueueCommand, HandlerCommand } from './commands.js'
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
 * Successful domain execution data.
 */
export interface DomainExecutionSuccess<TEvent> {
  /** Events to apply optimistically */
  anticipatedEvents: TEvent[]
  /** Optional post-processing instructions */
  postProcessPlan?: PostProcessPlan
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
 * Domain execution error — either validation failure or unknown command.
 */
export type DomainExecutionError = ValidationException | UnknownCommandException

/**
 * Result of domain command execution.
 */
export type DomainExecutionResult<TEvent> = Result<
  DomainExecutionSuccess<TEvent>,
  DomainExecutionError
>

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
   * Does NOT run the handler.
   */
  validate(
    command: ExecutorCommand,
    state: unknown | undefined,
  ): Promise<Result<unknown, DomainExecutionError>>

  /**
   * Run the handler only. No validation.
   * Produces anticipated events from the (possibly transformed) command data.
   *
   * @param command - The command envelope with data ready for the handler
   * @param context - Execution context (phase and entity ID for regeneration)
   * @returns Success with anticipated events, or failure
   */
  handle(
    command: ExecutorCommand,
    state: unknown | undefined,
    context: HandlerContext,
  ): DomainExecutionResult<TEvent>

  getRegistration(
    commandType: string,
  ): CommandHandlerRegistration<TLink, TCommand, TSchema, TEvent> | undefined
}

/**
 * Type guard for successful domain execution.
 */
export function isDomainSuccess<TEvent>(
  result: DomainExecutionResult<TEvent>,
): result is OkResult<DomainExecutionSuccess<TEvent>> {
  return result.ok
}

/**
 * Type guard for failed domain execution.
 */
export function isDomainFailure<TEvent>(
  result: DomainExecutionResult<TEvent>,
): result is ErrResult<DomainExecutionError> {
  return !result.ok
}

/**
 * Helper to create a successful domain execution result.
 */
export function domainSuccess<TEvent>(
  anticipatedEvents: TEvent[],
  postProcessPlan?: PostProcessPlan,
): DomainExecutionResult<TEvent> {
  return Ok({ anticipatedEvents, postProcessPlan })
}

/**
 * Helper to create a failed domain execution result.
 */
export function domainFailure(errors: ValidationError[]): DomainExecutionResult<never> {
  return Err(new ValidationException(errors))
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
      validate?(data: unknown, state: unknown | undefined): Result<unknown, ValidationException>
      /** Phase 3: async validation querying local data (permissions, name conflicts, etc.). */
      validateAsync?(
        command: C,
        state: unknown | undefined,
        context: AsyncValidationContext<TLink>,
      ): Promise<Result<unknown, ValidationException>>
      /** Phase 4: produce anticipated events from validated data. */
      handler(
        command: HandlerCommand<C['data']>,
        state: unknown | undefined,
        context: HandlerContext,
      ): DomainExecutionResult<TEvent>
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
 * Validation: asserts every `commandIdReferences` path is rooted at `$.data` or `$.path`.
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

const VALID_COMMAND_PATH_ROOTS = new Set(['data', 'path'])

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
        `root segment must be "data" or "path", got "${root}"`,
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
      state: unknown | undefined,
    ): Promise<Result<unknown, DomainExecutionError>> {
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
      state: unknown | undefined,
      context: HandlerContext,
    ): DomainExecutionResult<TEvent> {
      const reg = registrationMap.get(command.type)
      if (!reg) {
        return Err(new UnknownCommandException(command.type))
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
