/**
 * Event processor types.
 * Event processors transform events into read model updates.
 */

import type { EventPersistence } from '../../types/events.js'

/**
 * Read model update operation.
 *
 * - `set`: Replace the entire read model with `data`.
 * - `merge`: Shallow-merge `data` into the existing read model (`{ ...existing, ...data }`).
 *   Each property value must be the **complete new value** for that property — the store
 *   replaces the property wholesale, it does not deep-merge nested objects or arrays.
 *   Use this when only a subset of properties changed and the processor has computed their
 *   full new values (e.g., a complete replacement `tags` array, not an append delta).
 *   To unset a property, set it to `null` explicitly — `undefined` values are ignored
 *   by the shallow spread and will not remove existing properties.
 * - `delete`: Remove the read model entirely.
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
 * Signal that the processor cannot apply the event and the collection should be refetched.
 */
export interface InvalidateSignal {
  invalidate: true
}

/**
 * Possible return values from an event processor.
 */
export type ProcessorReturn<TModel extends object = Record<string, unknown>> =
  | ProcessorResult<TModel>[]
  | ProcessorResult<TModel>
  | InvalidateSignal
  | undefined

/**
 * Event processor function signature.
 * Receives an event and returns zero or more read model updates, or an invalidation signal.
 * May be sync or async.
 */
export type EventProcessor<TEvent = unknown, TModel extends object = Record<string, unknown>> = (
  event: TEvent,
  context: ProcessorContext,
) => ProcessorReturn<TModel> | Promise<ProcessorReturn<TModel>>

/**
 * Context passed to event processors.
 */
export interface ProcessorContext {
  /** Event persistence type */
  persistence: EventPersistence
  /** For anticipated events, the command ID */
  commandId?: string
  /** Stream revision of the event (absent for anticipated events) */
  revision?: bigint
  /** Global position of the event (absent for anticipated events) */
  position?: bigint
  /** Stream ID the event belongs to */
  streamId: string
  /** Unique event ID */
  eventId: string
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
export interface ProcessorRegistration<TEvent = unknown, TModel extends object = object> {
  /** Event type(s) this processor handles */
  eventTypes: string | string[]
  /** The processor function */
  processor(
    event: TEvent,
    context: ProcessorContext,
  ): ProcessorReturn<TModel> | Promise<ProcessorReturn<TModel>>
  /** Optional: Only process certain persistence types */
  persistenceTypes?: EventPersistence[]
}
