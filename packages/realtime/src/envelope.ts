/**
 * Canonical WebSocket message protocol — shared between client and server.
 *
 * Types and serialization helpers mirror the event-sourcing project's
 * server-cores/realtime-server-core/src/envelope.ts so that the demo
 * server reproduces the real server's contracts faithfully.
 */

import type { ISerializedEvent } from '@meticoeus/ddd-es'

// ── Server → Client messages ──

export interface ConnectedMessage {
  readonly type: 'connected'
  readonly heartbeatInterval: number
  readonly userId: string
  readonly expiresAtMs: number | null
}

export interface EventMessage {
  readonly type: 'event'
  readonly topics: readonly string[]
  readonly service: string
  readonly aggregateType: string
  readonly event: ISerializedEvent
}

export interface SubscribedMessage {
  readonly type: 'subscribed'
  readonly topics: readonly string[]
}

export interface UnsubscribedMessage {
  readonly type: 'unsubscribed'
  readonly topics: readonly string[]
}

export interface SubscriptionDeniedMessage {
  readonly type: 'subscription_denied'
  readonly topics: readonly string[]
  readonly message: string
}

export interface SubscriptionRevokedMessage {
  readonly type: 'subscription_revoked'
  readonly topics: readonly string[]
  readonly message: string
}

export interface HeartbeatMessage {
  readonly type: 'heartbeat'
}

export type ServerMessage =
  | ConnectedMessage
  | EventMessage
  | SubscribedMessage
  | UnsubscribedMessage
  | SubscriptionDeniedMessage
  | SubscriptionRevokedMessage
  | HeartbeatMessage

// ── Client → Server messages ──

export interface SubscribeMessage {
  readonly type: 'subscribe'
  readonly topics: readonly string[]
}

export interface UnsubscribeMessage {
  readonly type: 'unsubscribe'
  readonly topics: readonly string[]
}

export type ClientMessage = SubscribeMessage | UnsubscribeMessage

// ── Server-side helpers ──

/** Serialize a ServerMessage to a JSON string for WebSocket send. */
export function serializeServerMessage(message: ServerMessage): string {
  return JSON.stringify(message)
}

/** Parse a JSON string from WebSocket receive into a ClientMessage. Returns undefined if malformed. */
export function parseClientMessage(raw: string): ClientMessage | undefined {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return undefined
  }

  if (typeof parsed !== 'object' || parsed === null) return undefined

  const obj = parsed as Record<string, unknown>
  const type = obj['type']

  if (type !== 'subscribe' && type !== 'unsubscribe') return undefined

  const topics = obj['topics']
  if (!Array.isArray(topics)) return undefined
  if (!topics.every((t): t is string => typeof t === 'string')) return undefined

  if (type === 'subscribe') {
    const message: SubscribeMessage = { type, topics }
    return message
  }

  const message: UnsubscribeMessage = { type, topics }
  return message
}

// ── Client-side helpers ──

const SERVER_MESSAGE_TYPES = new Set([
  'connected',
  'event',
  'subscribed',
  'unsubscribed',
  'subscription_denied',
  'subscription_revoked',
  'heartbeat',
])

/** Parse a JSON string from WebSocket receive into a ServerMessage. Returns undefined if malformed. */
export function parseServerMessage(raw: string): ServerMessage | undefined {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return undefined
  }

  if (typeof parsed !== 'object' || parsed === null) return undefined

  const obj = parsed as Record<string, unknown>
  const type = obj['type']

  if (typeof type !== 'string' || !SERVER_MESSAGE_TYPES.has(type)) return undefined

  // Client trusts the server — validate the discriminant only
  return obj as unknown as ServerMessage
}

/** Serialize a ClientMessage to a JSON string for WebSocket send. */
export function serializeClientMessage(message: ClientMessage): string {
  return JSON.stringify(message)
}
