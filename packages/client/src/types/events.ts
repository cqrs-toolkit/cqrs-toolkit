/**
 * Library event types for the CQRS Client.
 * These are internal events emitted by the library, not domain events.
 */

export type EventPersistence = 'Permanent' | 'Stateful' | 'Anticipated'

/**
 * Base event metadata present on all events.
 */
export interface BaseEventMeta {
  /** Unique event identifier */
  id: string
  /** Event creation timestamp (epoch ms) */
  createdAt: number
}

/**
 * Permanent event - server-authoritative with global ordering.
 * If persistence field is missing, treat as Permanent.
 */
export interface PermanentEventMeta extends BaseEventMeta {
  persistence?: 'Permanent'
  /** Stream-local revision number */
  revision: bigint
  /** Global position for ordering */
  position: bigint
}

/**
 * Stateful event - server event without global ordering.
 * Best-effort delivery, may require snapshot refetch.
 */
export interface StatefulEventMeta extends BaseEventMeta {
  persistence: 'Stateful'
}

/**
 * Anticipated event - client-side optimistic event.
 * Associated with a command, replaced when server confirms.
 */
export interface AnticipatedEventMeta extends BaseEventMeta {
  persistence: 'Anticipated'
  /** Command that produced this anticipated event */
  commandId: string
}

/**
 * Union of all event metadata types.
 */
export type EventMeta = PermanentEventMeta | StatefulEventMeta | AnticipatedEventMeta

/**
 * Generic event wrapper type.
 * Domain events extend this with their specific payload.
 */
export interface BaseEvent<TPayload = unknown> {
  /** Event type name (e.g., 'TodoCreated', 'UserUpdated') */
  type: string
  /** Event payload */
  data: TPayload
  /** Stream/aggregate identifier */
  streamId: string
}

/**
 * Server event (Permanent or Stateful).
 */
export type ServerEvent<TPayload = unknown> = BaseEvent<TPayload> &
  (PermanentEventMeta | StatefulEventMeta)

/**
 * Anticipated event produced by local command execution.
 */
export type AnticipatedEvent<TPayload = unknown> = BaseEvent<TPayload> & AnticipatedEventMeta

/**
 * Any event type the library may handle.
 */
export type AnyEvent<TPayload = unknown> = ServerEvent<TPayload> | AnticipatedEvent<TPayload>

/**
 * Library-level events emitted to consumers.
 */
export type LibraryEventType =
  | 'session:changed'
  | 'session:destroyed'
  | 'connectivity:changed'
  | 'sync:started'
  | 'sync:completed'
  | 'sync:failed'
  | 'cache:evicted'
  | 'command:enqueued'
  | 'command:status-changed'
  | 'command:completed'
  | 'command:failed'
  | 'readmodel:updated'
  | 'error:storage'
  | 'error:network'

/**
 * Library event payload types.
 */
export interface LibraryEventPayloads {
  'session:changed': { userId: string; isNew: boolean }
  'session:destroyed': { reason: 'user-changed' | 'explicit' | 'storage-error' }
  'connectivity:changed': { online: boolean }
  'sync:started': { collection: string }
  'sync:completed': { collection: string; eventCount: number }
  'sync:failed': { collection: string; error: string }
  'cache:evicted': { cacheKey: string; reason: 'lru' | 'explicit' | 'session-change' }
  'command:enqueued': { commandId: string; type: string }
  'command:status-changed': { commandId: string; status: string; previousStatus: string }
  'command:completed': { commandId: string; type: string }
  'command:failed': { commandId: string; type: string; error: string }
  'readmodel:updated': { collection: string; ids: string[] }
  'error:storage': { message: string; code?: string }
  'error:network': { message: string; code?: string }
}

/**
 * Typed library event.
 */
export interface LibraryEvent<T extends LibraryEventType = LibraryEventType> {
  type: T
  payload: LibraryEventPayloads[T]
  timestamp: number
}

/**
 * Normalize event persistence - missing field means Permanent.
 */
export function normalizeEventPersistence(event: {
  persistence?: EventPersistence
}): EventPersistence {
  return event.persistence ?? 'Permanent'
}

/**
 * Type guard for permanent events.
 */
export function isPermanentEvent<T>(
  event: AnyEvent<T>,
): event is ServerEvent<T> & PermanentEventMeta {
  return normalizeEventPersistence(event) === 'Permanent'
}

/**
 * Type guard for stateful events.
 */
export function isStatefulEvent<T>(
  event: AnyEvent<T>,
): event is ServerEvent<T> & StatefulEventMeta {
  return normalizeEventPersistence(event) === 'Stateful'
}

/**
 * Type guard for anticipated events.
 */
export function isAnticipatedEvent<T>(event: AnyEvent<T>): event is AnticipatedEvent<T> {
  return normalizeEventPersistence(event) === 'Anticipated'
}
