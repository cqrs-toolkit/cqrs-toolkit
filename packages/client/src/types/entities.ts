/**
 * Entity lifecycle types for client-side entity tracking.
 *
 * EntityRef makes entity lifecycle state visible in read model data for
 * locally-created entities whose IDs are pending server confirmation.
 *
 * See specification §15 (EntityRef) for full details.
 */

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
 * Create an EntityRef value.
 */
export function createEntityRef(
  entityId: string,
  commandId: string,
  idStrategy: 'temporary' | 'permanent',
): EntityRef {
  return { __entityRef: true, entityId, commandId, idStrategy }
}
