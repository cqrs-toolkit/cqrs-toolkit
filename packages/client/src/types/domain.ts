/**
 * Domain layer contract types.
 * The domain layer is consumer-provided, not library-provided.
 */

import {
  Err,
  type ErrResult,
  Exception,
  type Link,
  Ok,
  type OkResult,
  type Result,
} from '@meticoeus/ddd-es'
import type { IAnticipatedEvent } from '../core/command-lifecycle/AnticipatedEventShape.js'
import type { IQueryManager } from '../core/query-manager/types.js'
import { assert } from '../utils/assert.js'
import { generateId } from '../utils/uuid.js'
import { EnqueueCommand } from './commands.js'
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
 * During initial execution, generates a new random UUID.
 * During regeneration, returns the entity ID from the original execution.
 *
 * @param context - The handler context
 * @returns A stable entity ID
 */
export function createEntityId(context: HandlerContext): string {
  return context.phase === 'initializing' ? generateId() : context.entityId
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
 * Minimum command envelope shape required by the domain executor.
 * The executor needs the command type for dispatch, data for validation/handling,
 * and path for URL template values passed to validateAsync and handler contexts.
 */
export interface ExecutorCommand {
  /** Command type for dispatch */
  type: string
  /** Command data (HTTP body payload) */
  data: unknown
  /** URL path template values from the command envelope */
  path?: unknown
}

/**
 * Domain executor interface - consumer implements this.
 * The library is agnostic to how validation is performed internally.
 *
 * @template TEvent - Event type produced by the executor
 */
export interface IDomainExecutor<TEvent = unknown> {
  /**
   * Execute a command through the validation pipeline and produce anticipated events.
   *
   * On initial execution (`'initializing'`), runs all validation phases
   * (schema, validate, validateAsync) before the handler.
   * On regeneration (`'updating'`), skips validation and runs the handler directly.
   *
   * @param command - The command envelope to execute
   * @param context - Execution context (phase and entity ID for regeneration)
   * @returns Success with anticipated events, or failure with validation errors
   */
  execute(command: ExecutorCommand, context: HandlerContext): Promise<DomainExecutionResult<TEvent>>
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
      commandType: C['type']
      /** Phase 1: structural schema validation (library-driven). */
      schema?: TSchema
      /** Phase 2: custom sync validation for rules the schema can't cover. */
      validate?(data: unknown): Result<unknown, ValidationException>
      /** Phase 3: async validation querying local data (permissions, name conflicts, etc.). */
      validateAsync?(
        command: C,
        context: AsyncValidationContext<TLink>,
      ): Promise<Result<unknown, ValidationException>>
      /** Phase 4: produce anticipated events from validated data. */
      handler(command: C, context: HandlerContext): DomainExecutionResult<TEvent>
      /** If this command creates a new aggregate, configure how to extract the server ID. */
      creates?: CreateCommandConfig
      /** Cross-aggregate parent references. Each entry maps a data field to the command that produces the ID. */
      parentRef?: ParentRefConfig[]
    }
  : never

/**
 * Configuration for a cross-aggregate parent reference in a command data.
 * Tells the library which data field contains a parent aggregate's ID and
 * which create command type produces that ID.
 */
export interface ParentRefConfig {
  /** Field name in the data that contains the parent aggregate ID (e.g., 'parentId', 'folderId'). */
  field: string
  /** Command type that produces this ID. The library uses that command's `creates` config for ID extraction. */
  fromCommand: string
}

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
 *
 * The executor runs validation phases (schema, validate) before the handler
 * on initial execution. On regeneration, validation is skipped — data was
 * already validated and transformed during initial execution.
 *
 * Returns both the executor and a metadata lookup for registration config.
 */
export function createDomainExecutor<
  TLink extends Link,
  TCommand extends EnqueueCommand,
  TSchema,
  TEvent extends IAnticipatedEvent,
>(
  registrations: CommandHandlerRegistration<TLink, TCommand, TSchema, TEvent>[],
  options?: CreateDomainExecutorOptions<TLink, TSchema>,
): IDomainExecutor<TEvent> & ICommandHandlerMetadata<TLink, TCommand, TSchema, TEvent> {
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
    registrationMap.set(reg.commandType, reg)
  }

  return {
    async execute(
      command: ExecutorCommand,
      context: HandlerContext,
    ): Promise<DomainExecutionResult<TEvent>> {
      const { type, data } = command
      const reg = registrationMap.get(type)
      if (!reg) {
        return Err(new UnknownCommandException(type))
      }

      let currentData = data

      // Validation phases only run on initial execution, not regeneration.
      // During regeneration, data was already validated and transformed.
      if (context.phase === 'initializing') {
        // Phase 1: schema validation
        if (reg.schema !== undefined && schemaValidator) {
          const schemaResult = schemaValidator.validate(reg.schema, currentData)
          if (!schemaResult.ok) return schemaResult
          currentData = schemaResult.value
        }

        // Phase 2: custom sync validation
        if (reg.validate) {
          const validateResult = reg.validate(currentData)
          if (!validateResult.ok) return validateResult
          currentData = validateResult.value
        }

        // Phase 3: async validation (queries local read model)
        if (reg.validateAsync && queryManager) {
          const asyncResult = await reg.validateAsync(
            { ...command, data: currentData } as TCommand,
            { queryManager },
          )
          if (!asyncResult.ok) return asyncResult
          currentData = asyncResult.value
        }
      }

      return reg.handler({ ...command, data: currentData } as TCommand, context)
    },

    getRegistration(
      commandType: string,
    ): CommandHandlerRegistration<TLink, TCommand, TSchema, TEvent> | undefined {
      return registrationMap.get(commandType)
    },
  }
}
