import type { AggregateEventData } from '@meticoeus/ddd-es'
import type { EntityId } from '../../types/entities.js'

/**
 * Data constraint for client-side anticipated events.
 *
 * Broadens `AggregateEventData` from ddd-es to accept `EntityId` for the `id` field.
 * For create commands with temporary IDs, `createEntityId(context)` returns an `EntityRef`
 * which carries lifecycle metadata. The `id` field in anticipated event data may be
 * either a plain string or an EntityRef.
 */
export interface AnticipatedAggregateEventData extends Omit<AggregateEventData, 'id'> {
  readonly id: EntityId
}

/**
 * Client-side anticipated event shape.
 *
 * Mirrors ddd-es `IEvent` but scoped to client-side event generation:
 * - `type` and `data` from `IEvent`
 * - `streamId` for stream routing (from `IPersistedEvent`)
 * - No `metadata` (TBD) or `persistence` (not needed client-side)
 * - `Data` extends `AnticipatedEventData` (requires `{ readonly id: EntityId }`)
 *   without an index signature — consumers get exact type checking on data.
 *
 * Consumers write typed event unions for type-safe handlers:
 * ```typescript
 * type TodoCreatedEvent = IAnticipatedEvent<'TodoCreated', {
 *   readonly id: EntityId
 *   readonly content: string
 * }>
 * type TodoEvent = TodoCreatedEvent | TodoDeletedEvent
 * ```
 */
export interface IAnticipatedEvent<
  Type extends string = string,
  Data extends AnticipatedAggregateEventData = AnticipatedAggregateEventData,
> {
  type: Type
  data: Data
  streamId: string
}

/** Type guard: does a value look like an anticipated event with required fields? */
export function isAnticipatedEvent(value: unknown): value is IAnticipatedEvent {
  if (typeof value !== 'object' || value === null) return false
  return (
    'type' in value &&
    typeof value.type === 'string' &&
    'data' in value &&
    'streamId' in value &&
    typeof value.streamId === 'string'
  )
}
