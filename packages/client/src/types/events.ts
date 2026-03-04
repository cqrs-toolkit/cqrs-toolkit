/**
 * Library event types for the CQRS Client.
 * These are internal events emitted by the library, not domain events.
 */

import type { IPersistedEvent, ISerializedEvent } from '@meticoeus/ddd-es'

export type EventPersistence = 'Permanent' | 'Stateful' | 'Anticipated'

/**
 * Anticipated event metadata — client-side optimistic event.
 * Associated with a command, replaced when server confirms.
 */
export interface AnticipatedEventMeta {
  /** Unique event identifier */
  id: string
  /** Event creation timestamp (epoch ms) */
  createdAt: number
  persistence: 'Anticipated'
  /** Command that produced this anticipated event */
  commandId: string
}

/**
 * Anticipated event produced by local command execution.
 */
export interface AnticipatedEvent<TPayload = unknown> {
  type: string
  data: TPayload
  streamId: string
  id: string
  createdAt: number
  persistence: 'Anticipated'
  commandId: string
}

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
  | 'cache:too-many-windows'
  | 'cache:session-reset'
  | 'sync:seed-completed'
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
  'cache:evicted': { cacheKey: string; reason: 'lru' | 'explicit' | 'expired' | 'session-change' }
  'cache:too-many-windows': { windowId: string; maxWindows: number }
  'cache:session-reset': { previousUserId: string; newUserId: string }
  'sync:seed-completed': { collection: string; cacheKey: string; recordCount: number }
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
 * Accepts the ddd-es persistence values ('Permanent' | 'Stateful' | 'Ephemeral') in addition
 * to the client-only 'Anticipated' value. Ephemeral events are not persisted, so this value
 * should never appear on an IPersistedEvent; if it does, we treat it as Permanent.
 */
export function normalizeEventPersistence(event: {
  persistence?: EventPersistence | 'Ephemeral'
}): EventPersistence {
  const p = event.persistence
  if (p === 'Permanent' || p === 'Stateful' || p === 'Anticipated') return p
  return 'Permanent'
}

/**
 * Hydrate a serialized event (JSON wire format) into a persisted event.
 * Converts string revision/position to bigint. All other fields pass through unchanged.
 *
 * Use this in Collection fetch method implementations to convert server JSON
 * responses into the IPersistedEvent type the library expects.
 */
export function hydrateSerializedEvent(event: ISerializedEvent): IPersistedEvent {
  return {
    ...event,
    revision: BigInt(event.revision),
    position: BigInt(event.position),
  }
}
