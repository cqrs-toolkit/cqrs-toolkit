import type { AggregateEventData } from '@meticoeus/ddd-es'

/**
 * Client-side anticipated event shape.
 *
 * Mirrors ddd-es `IEvent` but scoped to client-side event generation:
 * - `type` and `data` from `IEvent`
 * - `streamId` for stream routing (from `IPersistedEvent`)
 * - No `metadata` (TBD) or `persistence` (not needed client-side)
 * - `Data` extends `AggregateEventData` (requires `{ readonly id: string }`)
 *   without an index signature — consumers get exact type checking on data.
 *
 * Consumers write typed event unions for type-safe handlers:
 * ```typescript
 * type TodoCreatedEvent = IAnticipatedEvent<'TodoCreated', {
 *   readonly id: string
 *   readonly content: string
 * }>
 * type TodoEvent = TodoCreatedEvent | TodoDeletedEvent
 * ```
 */
export interface IAnticipatedEvent<
  Type extends string = string,
  Data extends AggregateEventData = AggregateEventData,
> {
  type: Type
  data: Data
  streamId: string
}

/**
 * @deprecated Use {@link IAnticipatedEvent} instead.
 */
export type AnticipatedEventShape = IAnticipatedEvent

/** Type guard: does a value look like an anticipated event with required fields? */
export function isAnticipatedEventShape(value: unknown): value is IAnticipatedEvent {
  if (typeof value !== 'object' || value === null) return false
  return (
    'type' in value &&
    typeof value.type === 'string' &&
    'data' in value &&
    'streamId' in value &&
    typeof value.streamId === 'string'
  )
}
