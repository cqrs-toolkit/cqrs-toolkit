/**
 * Event processor types.
 * Event processors transform events into read model updates.
 */

import type { EventPersistence } from '../../types/events.js'

/**
 * Read model update operation.
 */
export type UpdateOperation<T extends object> =
  | { type: 'set'; data: T }
  | { type: 'merge'; data: Partial<T> }
  | { type: 'delete' }

/**
 * Result of processing an event.
 */
export interface ProcessorResult<T extends object = Record<string, unknown>> {
  /** Collection to update */
  collection: string
  /** Entity ID to update */
  id: string
  /** Update operation */
  update: UpdateOperation<T>
  /** Whether this is a server baseline update (vs optimistic) */
  isServerUpdate: boolean
}

/**
 * Event processor function signature.
 * Receives an event and returns zero or more read model updates.
 */
export type EventProcessor<TEvent = unknown, TModel extends object = Record<string, unknown>> = (
  event: TEvent,
  context: ProcessorContext,
) => ProcessorResult<TModel>[] | ProcessorResult<TModel> | undefined

/**
 * Context passed to event processors.
 */
export interface ProcessorContext {
  /** Event persistence type */
  persistence: EventPersistence
  /** For anticipated events, the command ID */
  commandId?: string
  /** Stream revision of the event (string for JSON read model compatibility). Undefined for anticipated/stateful events. */
  revision?: string
  /** Get current read model state (may not exist) */
  getCurrentState: <T>(collection: string, id: string) => Promise<T | undefined>
}

/**
 * Processor registration.
 *
 * Uses method syntax for `processor` so that registrations with specific event/model types
 * are assignable to `ProcessorRegistration[]` (bivariant parameter checking).
 * This allows typed processors to be collected into heterogeneous arrays.
 */
export interface ProcessorRegistration<
  TEvent = unknown,
  TModel extends object = Record<string, unknown>,
> {
  /** Event type(s) this processor handles */
  eventTypes: string | string[]
  /** The processor function */
  processor(
    event: TEvent,
    context: ProcessorContext,
  ): ProcessorResult<TModel>[] | ProcessorResult<TModel> | undefined
  /** Optional: Only process certain persistence types */
  persistenceTypes?: EventPersistence[]
}
