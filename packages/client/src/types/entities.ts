/**
 * Entity lifecycle types for client-side entity tracking.
 *
 * EntityRef makes entity lifecycle state visible in read model data for
 * locally-created entities whose IDs are pending server confirmation.
 *
 * See specification §15 (EntityRef) for full details.
 */

import { Link, ServiceLink } from '@meticoeus/ddd-es'

/**
 * Entity reference carrying lifecycle metadata.
 *
 * Present in read model data for locally-created entities with pending IDs.
 * Replaced by a plain string when the server confirms the entity.
 *
 * EntityRef carries only identity and command lifecycle — not entity type.
 * Type information comes from the surrounding context: the read model
 * collection, the field name, or the Link object the ID is embedded in.
 */
export interface EntityRef {
  /** Discriminant for runtime identification. */
  readonly __entityRef: true
  /** The current entity ID (client-generated). */
  readonly entityId: string
  /** The command that created this entity. */
  readonly commandId: string
  /** Whether the server will replace this ID. */
  readonly idStrategy: 'temporary' | 'permanent'
}

/**
 * An entity ID value.
 *
 * Plain string for server-confirmed entities.
 * EntityRef for locally-created entities with pending IDs.
 */
export type EntityId = string | EntityRef

export interface EntityLink extends Omit<Link, 'id'> {
  id: EntityId
}

export interface EntityServiceLink extends Omit<ServiceLink, 'id'> {
  id: EntityId
}

export type EntityTLink<TLink extends Link> = Omit<TLink, 'id'> & { id: EntityId }

/**
 * Type guard for EntityRef values.
 */
export function isEntityRef(value: unknown): value is EntityRef {
  return (
    typeof value === 'object' &&
    value !== null &&
    '__entityRef' in value &&
    value.__entityRef === true
  )
}

/**
 * Type guard for EntityId values (plain string or EntityRef).
 */
export function isEntityId(value: unknown): value is EntityId {
  return typeof value === 'string' || isEntityRef(value)
}

/**
 * Extract the plain string ID from an EntityId value.
 *
 * Returns the string as-is for server-confirmed IDs, or the
 * embedded entityId for EntityRef values.
 * Passes through `undefined` when the id is absent.
 */
export function entityIdToString(id: EntityId): string
export function entityIdToString(id: EntityId | undefined): string | undefined
export function entityIdToString(id: EntityId | undefined): string | undefined {
  if (typeof id === 'string') return id
  if (isEntityRef(id)) return id.entityId
  return undefined
}

/**
 * Strict equality: same value AND same lifecycle state.
 *
 * Two strings are equal if identical. Two EntityRefs are equal if they have
 * the same entityId and commandId. A string and an EntityRef are never equal —
 * they represent different lifecycle states of the same entity.
 */
export function entityIdEquals(a: EntityId | undefined, b: EntityId | undefined): boolean {
  if (typeof a === 'undefined' && typeof b === 'undefined') return true
  if (typeof a === 'string' && typeof b === 'string') return a === b
  if (isEntityRef(a) && isEntityRef(b)) {
    return a.entityId === b.entityId && a.commandId === b.commandId
  }
  return false
}

/**
 * Lenient match: same logical entity regardless of lifecycle state.
 *
 * Compares resolved string IDs only. A string `'abc'` matches an EntityRef
 * with `entityId: 'abc'`. Useful for finding an entity across reconciliation
 * boundaries where the lifecycle representation has changed.
 */
export function entityIdMatches(a: EntityId | undefined, b: EntityId | undefined): boolean {
  return entityIdToString(a) === entityIdToString(b)
}

/**
 * Create an EntityRef value.
 */
export function createEntityRef(
  entityId: string,
  commandId: string,
  idStrategy: 'temporary' | 'permanent',
): EntityRef {
  return { __entityRef: true, entityId, commandId, idStrategy }
}
