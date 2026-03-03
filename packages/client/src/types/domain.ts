/**
 * Domain layer contract types.
 * The domain layer is consumer-provided, not library-provided.
 */

import type { ValidationError } from './validation.js'

/**
 * Post-processing plan for after server confirmation.
 * Used for temp ID replacement, cleanup, etc.
 */
export interface PostProcessPlan {
  /** Plan type identifier */
  kind: string
  /** Mapping of temporary IDs to placeholders */
  tempIds?: Record<string, string>
  /** Additional plan-specific data */
  [key: string]: unknown
}

/**
 * Successful domain execution result.
 */
export interface DomainExecutionSuccess<TEvent> {
  ok: true
  /** Events to apply optimistically */
  anticipatedEvents: TEvent[]
  /** Optional post-processing instructions */
  postProcessPlan?: PostProcessPlan
}

/**
 * Failed domain execution result.
 */
export interface DomainExecutionFailure {
  ok: false
  /** Validation errors from domain layer */
  errors: ValidationError[]
}

/**
 * Result of domain command execution.
 */
export type DomainExecutionResult<TEvent> = DomainExecutionSuccess<TEvent> | DomainExecutionFailure

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
): result is DomainExecutionSuccess<TEvent> {
  return result.ok
}

/**
 * Type guard for failed domain execution.
 */
export function isDomainFailure<TEvent>(
  result: DomainExecutionResult<TEvent>,
): result is DomainExecutionFailure {
  return !result.ok
}

/**
 * Helper to create a successful domain execution result.
 */
export function domainSuccess<TEvent>(
  anticipatedEvents: TEvent[],
  postProcessPlan?: PostProcessPlan,
): DomainExecutionSuccess<TEvent> {
  return { ok: true, anticipatedEvents, postProcessPlan }
}

/**
 * Helper to create a failed domain execution result.
 */
export function domainFailure(errors: ValidationError[]): DomainExecutionFailure {
  return { ok: false, errors }
}
