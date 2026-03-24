/**
 * WebSocket server — topic-based event push with wildcard subscriptions.
 *
 * Three components:
 * - matchesTopic: pattern matching for topic subscriptions
 * - SubscriptionRegistry: tracks which sockets subscribe to which topic patterns
 * - websocketPlugin: Fastify plugin wiring WebSocket connections to event store
 */

import type { DemoEventStore } from '@cqrs-toolkit/demo-base/common/server'
import type { ServerMessage } from '@cqrs-toolkit/realtime'
import { parseClientMessage, serializeServerMessage } from '@cqrs-toolkit/realtime'
import type { IEvent, ISerializedEvent, Persisted } from '@meticoeus/ddd-es'
import type { FastifyInstance, FastifyPluginAsync, FastifyRequest } from 'fastify'
import type { WebSocket } from 'ws'
import { type FakeUserStore, parseCookieHeader } from './session/routes.js'

const HEARTBEAT_INTERVAL_MS = 30_000

// ── Topic matching ──

/** Check if a subscription pattern matches an event topic. */
export function matchesTopic(pattern: string, eventTopic: string): boolean {
  if (pattern === '*') return true
  if (pattern.endsWith(':*')) {
    const prefix = pattern.slice(0, -1) // "Todo:*" → "Todo:"
    return eventTopic.startsWith(prefix)
  }
  return pattern === eventTopic
}

// ── Subscription registry ──

export class SubscriptionRegistry {
  private readonly topicToClients = new Map<string, Set<WebSocket>>()
  private readonly clientToTopics = new Map<WebSocket, Set<string>>()

  subscribe(socket: WebSocket, topics: ReadonlyArray<string>): void {
    let clientTopics = this.clientToTopics.get(socket)
    if (!clientTopics) {
      clientTopics = new Set()
      this.clientToTopics.set(socket, clientTopics)
    }

    for (const topic of topics) {
      clientTopics.add(topic)

      let clients = this.topicToClients.get(topic)
      if (!clients) {
        clients = new Set()
        this.topicToClients.set(topic, clients)
      }
      clients.add(socket)
    }
  }

  unsubscribe(socket: WebSocket, topics: ReadonlyArray<string>): void {
    const clientTopics = this.clientToTopics.get(socket)
    if (!clientTopics) return

    for (const topic of topics) {
      clientTopics.delete(topic)

      const clients = this.topicToClients.get(topic)
      if (clients) {
        clients.delete(socket)
        if (clients.size === 0) {
          this.topicToClients.delete(topic)
        }
      }
    }

    if (clientTopics.size === 0) {
      this.clientToTopics.delete(socket)
    }
  }

  removeClient(socket: WebSocket): void {
    const clientTopics = this.clientToTopics.get(socket)
    if (!clientTopics) return

    for (const topic of clientTopics) {
      const clients = this.topicToClients.get(topic)
      if (clients) {
        clients.delete(socket)
        if (clients.size === 0) {
          this.topicToClients.delete(topic)
        }
      }
    }

    this.clientToTopics.delete(socket)
  }

  getMatchingClients(eventTopic: string): Set<WebSocket> {
    const matched = new Set<WebSocket>()

    for (const [pattern, clients] of this.topicToClients) {
      if (matchesTopic(pattern, eventTopic)) {
        for (const client of clients) {
          matched.add(client)
        }
      }
    }

    return matched
  }
}

// ── Fastify plugin ──

function toSerializedEvent(event: Persisted<IEvent>): ISerializedEvent {
  return {
    streamId: event.streamId,
    id: event.id,
    revision: String(event.revision),
    position: String(event.position),
    type: event.type,
    data: event.data,
    metadata: event.metadata,
    created: event.created,
  }
}

/** Extract aggregate type prefix from a streamId (e.g., "Todo-abc" → "Todo"). */
function extractAggregateType(streamId: string): string {
  const dashIndex = streamId.indexOf('-')
  if (dashIndex === -1) return streamId
  return streamId.slice(0, dashIndex)
}

export interface WebSocketControl {
  pause(): void
  resume(): void
}

export function websocketPlugin(
  eventStore: DemoEventStore,
  userStore: FakeUserStore,
): { plugin: FastifyPluginAsync; control: WebSocketControl } {
  let accepting = true
  const connectedSockets = new Set<WebSocket>()

  const control: WebSocketControl = {
    pause() {
      accepting = false
      for (const socket of connectedSockets) {
        socket.terminate()
      }
    },
    resume() {
      accepting = true
    },
  }

  const plugin: FastifyPluginAsync = async function plugin(app: FastifyInstance): Promise<void> {
    const registry = new SubscriptionRegistry()

    // Heartbeat timer
    const heartbeatTimer = setInterval(() => {
      const message = serializeServerMessage({ type: 'heartbeat' })
      for (const socket of connectedSockets) {
        if (socket.readyState === socket.OPEN) {
          socket.send(message)
        }
      }
    }, HEARTBEAT_INTERVAL_MS)
    heartbeatTimer.unref()

    // Event store subscription — push events to matching clients
    const unsubscribe = eventStore.subscribe((event) => {
      const topic = extractTopic(event)
      if (!topic) return

      const clients = registry.getMatchingClients(topic)
      if (clients.size === 0) return

      const aggregateType = extractAggregateType(event.streamId)
      const message = serializeServerMessage({
        type: 'event',
        topics: [topic],
        service: 'demo',
        aggregateType,
        event: toSerializedEvent(event),
      })

      for (const client of clients) {
        if (client.readyState === client.OPEN) {
          client.send(message)
        }
      }
    })

    app.addHook('onClose', async () => {
      clearInterval(heartbeatTimer)
      unsubscribe()
    })

    // WebSocket route
    app.get(
      '/ws',
      {
        // @ts-ignore
        websocket: true,
        preValidation: async (_request, reply) => {
          if (!accepting) {
            reply.code(503).send()
          }
        },
      },
      (socket: WebSocket, request: FastifyRequest) => {
        connectedSockets.add(socket)

        // Resolve userId from cookie
        const cookieValue = parseCookieHeader(request.headers.cookie, 'demo_user_id')
        const user = cookieValue !== undefined ? userStore.get(cookieValue) : undefined
        const userId = user?.sub ?? 'anonymous'

        // Send connected message
        const connectedMsg: ServerMessage = {
          type: 'connected',
          heartbeatInterval: HEARTBEAT_INTERVAL_MS,
          userId,
          expiresAtMs: null,
        }
        socket.send(serializeServerMessage(connectedMsg))

        socket.on('message', (data: Buffer | ArrayBuffer | Buffer[]) => {
          const raw = typeof data === 'string' ? data : data.toString()
          const msg = parseClientMessage(raw)

          if (!msg) {
            // Silently ignore malformed messages — protocol has no error message type
            return
          }

          switch (msg.type) {
            case 'subscribe':
              registry.subscribe(socket, msg.topics)
              socket.send(serializeServerMessage({ type: 'subscribed', topics: msg.topics }))
              break

            case 'unsubscribe':
              registry.unsubscribe(socket, msg.topics)
              socket.send(serializeServerMessage({ type: 'unsubscribed', topics: msg.topics }))
              break
          }
        })

        socket.on('close', () => {
          connectedSockets.delete(socket)
          registry.removeClient(socket)
        })

        socket.on('error', () => {
          connectedSockets.delete(socket)
          registry.removeClient(socket)
        })
      },
    )
  }

  return { plugin, control }
}

// ── Helpers ──

function extractTopic(event: Persisted<IEvent>): string | undefined {
  const metadata = event.metadata as Record<string, unknown> | undefined
  const topic = metadata?.['topic']
  if (typeof topic !== 'string') return undefined
  return topic
}
