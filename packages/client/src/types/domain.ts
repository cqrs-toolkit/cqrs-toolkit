/**
 * Domain layer contract types.
 * The domain layer is consumer-provided, not library-provided.
 */

import {
  Err,
  type ErrResult,
  Ok,
  type OkResult,
  type Result,
  ValidationException,
} from '@meticoeus/ddd-es'
import { assert } from '../utils/assert.js'
import type { ValidationError } from './validation.js'

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
 * Successful domain execution payload.
 */
export interface DomainExecutionSuccess<TEvent> {
  /** Events to apply optimistically */
  anticipatedEvents: TEvent[]
  /** Optional post-processing instructions */
  postProcessPlan?: PostProcessPlan
}

/**
 * Result of domain command execution.
 */
export type DomainExecutionResult<TEvent> = Result<
  DomainExecutionSuccess<TEvent>,
  ValidationException<ValidationError[]>
>

/**
 * Domain executor interface - consumer implements this.
 * The library is agnostic to how validation is performed internally.
 *
 * @template TCommand - Command type accepted by the executor
 * @template TEvent - Event type produced by the executor
 */
export interface IDomainExecutor<TCommand = unknown, TEvent = unknown> {
  /**
   * Execute a command and produce anticipated events.
   * Validation happens here - return errors if command is invalid.
   *
   * This method must be:
   * - Pure: no side effects
   * - Deterministic: same input always produces same output
   * - Synchronous: no async operations
   *
   * @param command - The command to execute
   * @returns Success with anticipated events, or failure with validation errors
   */
  execute(command: TCommand): DomainExecutionResult<TEvent>
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
): result is ErrResult<ValidationException<ValidationError[]>> {
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
  return Err(new ValidationException(undefined, errors))
}

// ---------------------------------------------------------------------------
// Registration-based domain executor
// ---------------------------------------------------------------------------

/**
 * Registration for a single command handler.
 *
 * Uses method syntax for `handler` so that registrations with specific
 * payload types are assignable to `CommandHandlerRegistration[]`
 * (bivariant parameter checking — same pattern as ProcessorRegistration).
 */
export interface CommandHandlerRegistration<TEvent = unknown> {
  /** Command type this handler processes */
  commandType: string
  /** Validate payload and produce anticipated events */
  handler(payload: unknown): DomainExecutionResult<TEvent>
  /** If this command creates a new aggregate, configure how to extract the server ID. */
  creates?: CreateCommandConfig
  /** Payload field name that holds the revision for optimistic concurrency. Absent for creates. */
  revisionField?: string
  /** Cross-aggregate parent references. Each entry maps a payload field to the command that produces the ID. */
  parentRef?: ParentRefConfig[]
}

/**
 * Configuration for a cross-aggregate parent reference in a command payload.
 * Tells the library which payload field contains a parent aggregate's ID and
 * which create command type produces that ID.
 */
export interface ParentRefConfig {
  /** Field name in the payload that contains the parent aggregate ID (e.g., 'parentId', 'folderId'). */
  field: string
  /** Command type that produces this ID. The library uses that command's `creates` config for ID extraction. */
  fromCommand: string
}

/**
 * Metadata lookup for command handler registrations.
 * Allows the CommandQueue to access creates/revisionField config by command type.
 */
export interface ICommandHandlerMetadata {
  getRegistration(commandType: string): CommandHandlerRegistration | undefined
}

/**
 * Create a domain executor from an array of command handler registrations.
 *
 * Builds an internal lookup map for O(1) dispatch.
 * Asserts no duplicate command types — a duplicate means a config wiring bug.
 * Unknown command types at runtime return a validation failure.
 *
 * Returns both the executor and a metadata lookup for registration config.
 */
export function createDomainExecutor<TEvent = unknown>(
  registrations: CommandHandlerRegistration<TEvent>[],
): IDomainExecutor<unknown, TEvent> & ICommandHandlerMetadata {
  const registrationMap = new Map<string, CommandHandlerRegistration<TEvent>>()

  for (const reg of registrations) {
    assert(
      !registrationMap.has(reg.commandType),
      `Duplicate command handler registration for "${reg.commandType}"`,
    )
    registrationMap.set(reg.commandType, reg)
  }

  return {
    execute(command: unknown): DomainExecutionResult<TEvent> {
      const { type, payload } = command as { type: string; payload: unknown }
      const reg = registrationMap.get(type)
      if (!reg) {
        return domainFailure([{ path: 'type', message: `Unknown command type: ${type}` }])
      }
      return reg.handler(payload)
    },

    getRegistration(commandType: string): CommandHandlerRegistration | undefined {
      return registrationMap.get(commandType)
    },
  }
}
