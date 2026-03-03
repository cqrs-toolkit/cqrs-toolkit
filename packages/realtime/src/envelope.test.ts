import { describe, expect, it } from 'vitest'
import type {
  ClientMessage,
  ConnectedMessage,
  EventMessage,
  HeartbeatMessage,
  ServerMessage,
  SubscribedMessage,
  SubscriptionDeniedMessage,
  UnsubscribedMessage,
} from './envelope.js'
import {
  parseClientMessage,
  parseServerMessage,
  serializeClientMessage,
  serializeServerMessage,
} from './envelope.js'

// ── serializeServerMessage / parseServerMessage round-trip ──

describe('serializeServerMessage', () => {
  it('serializes a connected message', () => {
    const msg: ConnectedMessage = {
      type: 'connected',
      heartbeatInterval: 30000,
      userId: 'user-1',
      expiresAtMs: null,
    }
    const json = serializeServerMessage(msg)
    expect(JSON.parse(json)).toEqual(msg)
  })

  it('serializes an event message', () => {
    const msg: EventMessage = {
      type: 'event',
      topics: ['Todo:abc'],
      service: 'demo',
      aggregateType: 'Todo',
      event: {
        streamId: 'Todo-abc',
        id: 'evt-1',
        type: 'TodoCreated',
        revision: '0',
        position: '1',
        data: { id: 'abc', content: 'test' },
        metadata: { correlationId: 'c-1' },
        created: '2025-01-01T00:00:00.000Z',
      },
    }
    const json = serializeServerMessage(msg)
    expect(JSON.parse(json)).toEqual(msg)
  })

  it('serializes a heartbeat message', () => {
    const msg: HeartbeatMessage = { type: 'heartbeat' }
    const json = serializeServerMessage(msg)
    expect(JSON.parse(json)).toEqual(msg)
  })
})

describe('parseServerMessage', () => {
  it('parses a connected message', () => {
    const msg: ConnectedMessage = {
      type: 'connected',
      heartbeatInterval: 30000,
      userId: 'user-1',
      expiresAtMs: 1700000000000,
    }
    const result = parseServerMessage(JSON.stringify(msg))
    expect(result).toEqual(msg)
  })

  it('parses an event message', () => {
    const msg: EventMessage = {
      type: 'event',
      topics: ['Todo:abc'],
      service: 'demo',
      aggregateType: 'Todo',
      event: {
        streamId: 'Todo-abc',
        id: 'evt-1',
        type: 'TodoCreated',
        revision: '0',
        position: '1',
        data: { id: 'abc', content: 'test' },
        metadata: { correlationId: 'c-1' },
        created: '2025-01-01T00:00:00.000Z',
      },
    }
    const result = parseServerMessage(JSON.stringify(msg))
    expect(result).toEqual(msg)
  })

  it('parses a subscribed message', () => {
    const msg: SubscribedMessage = { type: 'subscribed', topics: ['Todo:*'] }
    const result = parseServerMessage(JSON.stringify(msg))
    expect(result).toEqual(msg)
  })

  it('parses an unsubscribed message', () => {
    const msg: UnsubscribedMessage = { type: 'unsubscribed', topics: ['Todo:*'] }
    const result = parseServerMessage(JSON.stringify(msg))
    expect(result).toEqual(msg)
  })

  it('parses a subscription_denied message', () => {
    const msg: SubscriptionDeniedMessage = {
      type: 'subscription_denied',
      topics: ['Secret:*'],
      message: 'Unauthorized',
    }
    const result = parseServerMessage(JSON.stringify(msg))
    expect(result).toEqual(msg)
  })

  it('parses a heartbeat message', () => {
    const result = parseServerMessage('{"type":"heartbeat"}')
    expect(result).toEqual({ type: 'heartbeat' })
  })

  it('returns undefined for invalid JSON', () => {
    expect(parseServerMessage('not json')).toBeUndefined()
  })

  it('returns undefined for non-object', () => {
    expect(parseServerMessage('"hello"')).toBeUndefined()
  })

  it('returns undefined for unknown type', () => {
    expect(parseServerMessage('{"type":"error"}')).toBeUndefined()
  })

  it('returns undefined for missing type', () => {
    expect(parseServerMessage('{"topics":["x"]}')).toBeUndefined()
  })
})

// ── serializeClientMessage / parseClientMessage round-trip ──

describe('serializeClientMessage', () => {
  it('serializes a subscribe message', () => {
    const msg: ClientMessage = { type: 'subscribe', topics: ['Todo:*', 'Note:*'] }
    const json = serializeClientMessage(msg)
    expect(JSON.parse(json)).toEqual(msg)
  })

  it('serializes an unsubscribe message', () => {
    const msg: ClientMessage = { type: 'unsubscribe', topics: ['Todo:*'] }
    const json = serializeClientMessage(msg)
    expect(JSON.parse(json)).toEqual(msg)
  })
})

describe('parseClientMessage', () => {
  it('parses a subscribe message', () => {
    const result = parseClientMessage('{"type":"subscribe","topics":["Todo:*"]}')
    expect(result).toEqual({ type: 'subscribe', topics: ['Todo:*'] })
  })

  it('parses an unsubscribe message', () => {
    const result = parseClientMessage('{"type":"unsubscribe","topics":["Note:*"]}')
    expect(result).toEqual({ type: 'unsubscribe', topics: ['Note:*'] })
  })

  it('returns undefined for invalid JSON', () => {
    expect(parseClientMessage('not json')).toBeUndefined()
  })

  it('returns undefined for non-object', () => {
    expect(parseClientMessage('42')).toBeUndefined()
  })

  it('returns undefined for unknown type', () => {
    expect(parseClientMessage('{"type":"heartbeat","topics":[]}')).toBeUndefined()
  })

  it('returns undefined for missing topics', () => {
    expect(parseClientMessage('{"type":"subscribe"}')).toBeUndefined()
  })

  it('returns undefined for non-array topics', () => {
    expect(parseClientMessage('{"type":"subscribe","topics":"Todo:*"}')).toBeUndefined()
  })

  it('returns undefined for non-string topic items', () => {
    expect(parseClientMessage('{"type":"subscribe","topics":[123]}')).toBeUndefined()
  })
})

// ── Round-trip: serialize then parse ──

describe('round-trip', () => {
  it('server message survives serialize → parse', () => {
    const original: ServerMessage = {
      type: 'event',
      topics: ['Todo:abc'],
      service: 'demo',
      aggregateType: 'Todo',
      event: {
        streamId: 'Todo-abc',
        id: 'evt-1',
        type: 'TodoCreated',
        revision: '0',
        position: '1',
        data: { id: 'abc', content: 'hello' },
        metadata: { correlationId: 'c-1' },
        created: '2025-01-01T00:00:00.000Z',
      },
    }
    const parsed = parseServerMessage(serializeServerMessage(original))
    expect(parsed).toEqual(original)
  })

  it('client message survives serialize → parse', () => {
    const original: ClientMessage = { type: 'subscribe', topics: ['Todo:*', 'Note:*'] }
    const parsed = parseClientMessage(serializeClientMessage(original))
    expect(parsed).toEqual(original)
  })
})
