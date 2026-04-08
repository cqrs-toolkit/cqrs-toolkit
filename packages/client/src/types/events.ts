/**
 * Library event types for the CQRS Client.
 * These are internal events emitted by the library, not domain events.
 */

import type { IPersistedEvent, ISerializedEvent, Link } from '@meticoeus/ddd-es'
import type { CacheKeyIdentity } from '../core/cache-manager/CacheKey.js'

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
export interface AnticipatedEvent<TData = unknown> {
  type: string
  data: TData
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
  | 'cache:key-added'
  | 'cache:key-accessed'
  | 'cache:evicted'
  | 'cache:frozen-changed'
  | 'cache:quota-low'
  | 'cache:quota-critical'
  | 'cache:too-many-windows'
  | 'cache:session-reset'
  | 'cache:seed-settled'
  | 'sync:seed-completed'
  | 'command:enqueued'
  | 'command:status-changed'
  | 'command:completed'
  | 'command:failed'
  | 'readmodel:updated'
  | 'error:storage'
  | 'error:network'
  | 'ws:connecting'
  | 'ws:connected'
  | 'ws:subscribed'
  | 'ws:disconnected'
  | 'sync:ws-event-received'
  | 'sync:ws-event-processed'
  | 'sync:gap-detected'
  | 'sync:gap-repair-started'
  | 'sync:gap-repair-completed'
  | 'sync:refetch-scheduled'
  | 'sync:refetch-executed'
  | 'command:sent'
  | 'command:response'
  | 'writequeue:op-enqueued'
  | 'writequeue:op-started'
  | 'writequeue:op-completed'
  | 'writequeue:op-error'
  | 'writequeue:op-discarded'
  | 'writequeue:reset-started'
  | 'writequeue:reset-completed'

/**
 * Library event data types.
 */
export interface LibraryEventData<TLink extends Link> {
  'session:changed': { userId: string; isNew: boolean }
  'session:destroyed': { reason: 'user-changed' | 'explicit' | 'storage-error' }
  'connectivity:changed': { online: boolean }
  'sync:started': { collection: string }
  'sync:completed': { collection: string; eventCount: number }
  'sync:failed': { collection: string; error: string }
  'cache:key-added': {
    cacheKey: CacheKeyIdentity<TLink>
    evictionPolicy: 'persistent' | 'ephemeral'
  }
  'cache:key-accessed': { cacheKey: CacheKeyIdentity<TLink> }
  'cache:evicted': {
    cacheKey: CacheKeyIdentity<TLink>
    reason: 'lru' | 'explicit' | 'expired' | 'session-change'
  }
  'cache:frozen-changed': {
    cacheKey: CacheKeyIdentity<TLink>
    frozen: boolean
    frozenAt: number | null
  }
  'cache:quota-low': { usedBytes: number; totalBytes: number }
  'cache:quota-critical': { usedBytes: number; totalBytes: number }
  'cache:too-many-windows': { windowId: string; maxWindows: number }
  'cache:session-reset': { previousUserId: string; newUserId: string }
  'cache:seed-settled': {
    cacheKey: CacheKeyIdentity<TLink>
    status: 'succeeded' | 'failed'
    collections: Array<{ name: string; seeded: boolean; error?: string }>
  }
  'sync:seed-completed': {
    collection: string
    cacheKey: CacheKeyIdentity<TLink>
    recordCount: number
  }
  'command:enqueued': { commandId: string; type: string; cacheKey: CacheKeyIdentity<TLink> }
  'command:status-changed': {
    commandId: string
    status: string
    previousStatus: string
    cacheKey: CacheKeyIdentity<TLink>
  }
  'command:completed': { commandId: string; type: string; cacheKey: CacheKeyIdentity<TLink> }
  'command:failed': {
    commandId: string
    type: string
    error: string
    cacheKey: CacheKeyIdentity<TLink>
  }
  'readmodel:updated': { collection: string; ids: string[] }
  'error:storage': { message: string; code?: string }
  'error:network': { message: string; code?: string }
  'ws:connecting': {}
  'ws:connected': {}
  'ws:subscribed': { topics: readonly string[] }
  'ws:disconnected': { topics: readonly string[] }
  'sync:ws-event-received': { event: IPersistedEvent }
  'sync:ws-event-processed': { event: IPersistedEvent; updatedIds: string[]; invalidated: boolean }
  'sync:gap-detected': { streamId: string; expected: bigint; received: bigint }
  'sync:gap-repair-started': { streamId: string; fromRevision: bigint }
  'sync:gap-repair-completed': { streamId: string; eventCount: number }
  'sync:refetch-scheduled': { collection: string; debounceMs: number }
  'sync:refetch-executed': { collection: string; recordCount: number }
  'command:sent': {
    commandId: string
    correlationId: string
    service: string
    type: string
    data: unknown
  }
  'command:response': { commandId: string; correlationId: string; response: unknown }
  'writequeue:op-enqueued': { opId: string; opType: string; priority: number; op: unknown }
  'writequeue:op-started': { opId: string; opType: string }
  'writequeue:op-completed': { opId: string; opType: string; durationMs: number }
  'writequeue:op-error': { opId: string; opType: string; error: string }
  'writequeue:op-discarded': { opId: string; opType: string; reason: string }
  'writequeue:reset-started': { reason: string }
  'writequeue:reset-completed': { reason: string }
}

/**
 * Typed library event.
 */
export interface LibraryEvent<TLink extends Link, T extends LibraryEventType = LibraryEventType> {
  type: T
  data: LibraryEventData<TLink>[T]
  timestamp: number
  /** Whether this event is a debug-only event (emitted via `emitDebug()`). */
  debug?: boolean
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
