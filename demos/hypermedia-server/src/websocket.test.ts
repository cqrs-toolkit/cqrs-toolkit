import type { CommandSuccessResponse } from '@cqrs-toolkit/demo-base/common/shared'
import type {
  ConnectedMessage,
  EventMessage,
  ServerMessage,
  SubscribedMessage,
  UnsubscribedMessage,
} from '@cqrs-toolkit/realtime'
import type { FastifyInstance } from 'fastify'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { WebSocket } from 'ws'
import { createApp } from './bootstrap.js'
import { matchesTopic, SubscriptionRegistry } from './websocket.js'

// ── matchesTopic ──

describe('matchesTopic', () => {
  it('* matches any topic', () => {
    expect(matchesTopic('*', 'Todo:abc')).toBe(true)
    expect(matchesTopic('*', 'Note:xyz')).toBe(true)
    expect(matchesTopic('*', 'anything')).toBe(true)
  })

  it('Todo:* matches any Todo topic', () => {
    expect(matchesTopic('Todo:*', 'Todo:abc')).toBe(true)
    expect(matchesTopic('Todo:*', 'Todo:123')).toBe(true)
  })

  it('Todo:* does not match Note topics', () => {
    expect(matchesTopic('Todo:*', 'Note:abc')).toBe(false)
  })

  it('Note:* does not match Todo topics', () => {
    expect(matchesTopic('Note:*', 'Todo:abc')).toBe(false)
  })

  it('exact match works', () => {
    expect(matchesTopic('Todo:abc', 'Todo:abc')).toBe(true)
    expect(matchesTopic('Todo:abc', 'Todo:def')).toBe(false)
  })
})

// ── SubscriptionRegistry ──

describe('SubscriptionRegistry', () => {
  it('subscribe + getMatchingClients returns the socket', () => {
    const registry = new SubscriptionRegistry()
    const socket = {} as unknown as WebSocket

    registry.subscribe(socket, ['Todo:abc'])

    const matched = registry.getMatchingClients('Todo:abc')
    expect(matched.has(socket)).toBe(true)
    expect(matched.size).toBe(1)
  })

  it('wildcard subscription matches across IDs', () => {
    const registry = new SubscriptionRegistry()
    const socket = {} as unknown as WebSocket

    registry.subscribe(socket, ['Todo:*'])

    expect(registry.getMatchingClients('Todo:abc').has(socket)).toBe(true)
    expect(registry.getMatchingClients('Todo:xyz').has(socket)).toBe(true)
    expect(registry.getMatchingClients('Note:abc').has(socket)).toBe(false)
  })

  it('global wildcard matches everything', () => {
    const registry = new SubscriptionRegistry()
    const socket = {} as unknown as WebSocket

    registry.subscribe(socket, ['*'])

    expect(registry.getMatchingClients('Todo:abc').has(socket)).toBe(true)
    expect(registry.getMatchingClients('Note:xyz').has(socket)).toBe(true)
  })

  it('removeClient cleans up all subscriptions', () => {
    const registry = new SubscriptionRegistry()
    const socket = {} as unknown as WebSocket

    registry.subscribe(socket, ['Todo:abc', 'Note:*'])
    registry.removeClient(socket)

    expect(registry.getMatchingClients('Todo:abc').size).toBe(0)
    expect(registry.getMatchingClients('Note:xyz').size).toBe(0)
  })

  it('unsubscribe removes only specified topics', () => {
    const registry = new SubscriptionRegistry()
    const socket = {} as unknown as WebSocket

    registry.subscribe(socket, ['Todo:abc', 'Note:xyz'])
    registry.unsubscribe(socket, ['Todo:abc'])

    expect(registry.getMatchingClients('Todo:abc').size).toBe(0)
    expect(registry.getMatchingClients('Note:xyz').has(socket)).toBe(true)
  })

  it('multiple clients on same topic both receive matches', () => {
    const registry = new SubscriptionRegistry()
    const socket1 = {} as unknown as WebSocket
    const socket2 = {} as unknown as WebSocket

    registry.subscribe(socket1, ['Todo:abc'])
    registry.subscribe(socket2, ['Todo:abc'])

    const matched = registry.getMatchingClients('Todo:abc')
    expect(matched.has(socket1)).toBe(true)
    expect(matched.has(socket2)).toBe(true)
    expect(matched.size).toBe(2)
  })

  it('removing one client does not affect others', () => {
    const registry = new SubscriptionRegistry()
    const socket1 = {} as unknown as WebSocket
    const socket2 = {} as unknown as WebSocket

    registry.subscribe(socket1, ['Todo:*'])
    registry.subscribe(socket2, ['Todo:*'])
    registry.removeClient(socket1)

    const matched = registry.getMatchingClients('Todo:abc')
    expect(matched.has(socket1)).toBe(false)
    expect(matched.has(socket2)).toBe(true)
  })

  it('no subscribers returns empty set', () => {
    const registry = new SubscriptionRegistry()
    expect(registry.getMatchingClients('Todo:abc').size).toBe(0)
  })
})

// ── Integration test ──

describe('WebSocket integration', () => {
  let app: FastifyInstance
  let baseUrl: string
  const sockets: WebSocket[] = []

  beforeAll(async () => {
    ;({ app } = createApp({ logLevel: 'silent' }))
    await app.listen({ port: 0, host: '127.0.0.1' })
    const address = app.server.address()
    if (typeof address === 'string' || !address) throw new Error('Unexpected address format')
    baseUrl = `127.0.0.1:${address.port}`
  })

  afterEach(() => {
    for (const socket of sockets) {
      socket.close()
    }
    sockets.length = 0
  })

  afterAll(async () => {
    await app.close()
  })

  it('receives connected message on connect', async () => {
    const socket = createWebSocket()
    const msg = await waitForMessage<ConnectedMessage>(socket)

    expect(msg.type).toBe('connected')
    expect(msg.heartbeatInterval).toBe(30_000)
    expect(msg.userId).toBe('anonymous')
    expect(msg.expiresAtMs).toBeNull()
  })

  it('receives subscribed ack after subscribing', async () => {
    const socket = createWebSocket()
    await waitForMessage(socket) // connected

    socket.send(JSON.stringify({ type: 'subscribe', topics: ['Todo:*'] }))
    const msg = await waitForMessage<SubscribedMessage>(socket)

    expect(msg.type).toBe('subscribed')
    expect(msg.topics).toEqual(['Todo:*'])
  })

  it('receives unsubscribed ack after unsubscribing', async () => {
    const socket = createWebSocket()
    await waitForMessage(socket) // connected

    socket.send(JSON.stringify({ type: 'subscribe', topics: ['Todo:*'] }))
    await waitForMessage(socket) // subscribed

    socket.send(JSON.stringify({ type: 'unsubscribe', topics: ['Todo:*'] }))
    const msg = await waitForMessage<UnsubscribedMessage>(socket)

    expect(msg.type).toBe('unsubscribed')
    expect(msg.topics).toEqual(['Todo:*'])
  })

  it('silently ignores malformed messages', async () => {
    const socket = createWebSocket()
    await waitForMessage(socket) // connected

    socket.send('not json')
    await expect(waitForMessage(socket, 200)).rejects.toThrow('Timed out')
  })

  it('pushes events to subscribers matching topic', async () => {
    const socket = createWebSocket()
    await waitForMessage(socket) // connected

    socket.send(JSON.stringify({ type: 'subscribe', topics: ['Todo:*'] }))
    await waitForMessage(socket) // subscribed

    // Create a todo via HTTP (hypermedia create surface)
    const res = await app.inject({
      method: 'POST',
      url: '/api/todos',
      payload: { content: 'WebSocket test' },
      headers: { 'x-request-id': 'req-ws-1', 'x-command-id': 'cmd-ws-1' },
    })
    const body = res.json<CommandSuccessResponse>()

    // Wait for event on WebSocket
    const eventMsg = await waitForMessage<EventMessage>(socket)

    expect(eventMsg.type).toBe('event')
    expect(eventMsg.topics).toEqual([`Todo:${body.id}`])
    expect(eventMsg.service).toBe('demo')
    expect(eventMsg.aggregateType).toBe('nb.Todo')
    expect(eventMsg.event.type).toBe('TodoCreated')
    expect(eventMsg.event.data).toMatchObject({ content: 'WebSocket test' })
  })

  it('does not push events to non-matching subscribers', async () => {
    const socket = createWebSocket()
    await waitForMessage(socket) // connected

    socket.send(JSON.stringify({ type: 'subscribe', topics: ['Note:*'] }))
    await waitForMessage(socket) // subscribed

    // Create a todo (not a note)
    await app.inject({
      method: 'POST',
      url: '/api/todos',
      payload: { content: 'Should not arrive' },
      headers: { 'x-request-id': 'req-ws-2', 'x-command-id': 'cmd-ws-2' },
    })

    // Should timeout waiting — no event should arrive
    await expect(waitForMessage(socket, 200)).rejects.toThrow('Timed out')
  })

  it('global wildcard receives all events', async () => {
    const socket = createWebSocket()
    await waitForMessage(socket) // connected

    socket.send(JSON.stringify({ type: 'subscribe', topics: ['*'] }))
    await waitForMessage(socket) // subscribed

    // Create a todo
    await app.inject({
      method: 'POST',
      url: '/api/todos',
      payload: { content: 'Global test' },
      headers: { 'x-request-id': 'req-ws-3', 'x-command-id': 'cmd-ws-3' },
    })

    const eventMsg = await waitForMessage<EventMessage>(socket)
    expect(eventMsg.type).toBe('event')
    expect(eventMsg.topics[0]).toMatch(/^Todo:/)
  })

  // --- Pause/resume ---

  describe('WebSocket pause/resume', () => {
    it('rejects new connections when paused', async () => {
      // Pause WS
      const pauseRes = await app.inject({ method: 'POST', url: '/api/test/ws-pause' })
      expect(pauseRes.statusCode).toBe(200)

      // Attempt WS connection — should get rejected
      const socket = createWebSocket()
      const closed = new Promise<{ code: number }>((resolve) => {
        socket.on('close', (code) => resolve({ code }))
        socket.on('error', () => {
          // expected — connection refused or terminated
        })
      })

      const result = await closed
      // WebSocket close code 1006 = abnormal closure (connection rejected)
      expect(result.code).toBe(1006)

      // Resume for other tests
      await app.inject({ method: 'POST', url: '/api/test/ws-resume' })
    })

    it('terminates existing connections when paused', async () => {
      const socket = createWebSocket()
      await waitForMessage(socket) // connected

      const closed = new Promise<void>((resolve) => {
        socket.on('close', () => resolve())
      })

      // Pause — should terminate existing connections
      await app.inject({ method: 'POST', url: '/api/test/ws-pause' })
      await closed

      // Resume — new connections should work
      await app.inject({ method: 'POST', url: '/api/test/ws-resume' })

      const newSocket = createWebSocket()
      const msg = await waitForMessage<ConnectedMessage>(newSocket)
      expect(msg.type).toBe('connected')
    })

    it('reset resumes WS', async () => {
      // Pause WS
      await app.inject({ method: 'POST', url: '/api/test/ws-pause' })

      // Reset — should resume WS
      await app.inject({ method: 'POST', url: '/api/test/reset' })

      // New connection should work
      const socket = createWebSocket()
      const msg = await waitForMessage<ConnectedMessage>(socket)
      expect(msg.type).toBe('connected')
    })
  })

  // --- Helpers ---

  function createWebSocket(): WebSocket {
    const socket = new WebSocket(`ws://${baseUrl}/ws`)
    sockets.push(socket)
    return socket
  }

  function waitForMessage<T extends ServerMessage>(
    socket: WebSocket,
    timeoutMs = 5000,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup()
        reject(new Error(`Timed out waiting for WebSocket message after ${timeoutMs}ms`))
      }, timeoutMs)

      function onMessage(data: Buffer | ArrayBuffer | Buffer[]): void {
        cleanup()
        const parsed = JSON.parse(data.toString()) as T
        resolve(parsed)
      }

      function onError(err: Error): void {
        cleanup()
        reject(err)
      }

      function cleanup(): void {
        clearTimeout(timeout)
        socket.off('message', onMessage)
        socket.off('error', onError)
      }

      if (socket.readyState === WebSocket.OPEN) {
        socket.on('message', onMessage)
        socket.on('error', onError)
      } else {
        socket.once('open', () => {
          socket.on('message', onMessage)
          socket.on('error', onError)
        })
      }
    })
  }
})
