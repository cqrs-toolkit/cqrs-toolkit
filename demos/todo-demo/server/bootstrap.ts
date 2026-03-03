/**
 * Server bootstrap — wires up infrastructure, repositories, and route plugins.
 *
 * Returns a configured Fastify instance ready for .listen() or .inject().
 */

import websocket from '@fastify/websocket'
import { logProvider } from '@meticoeus/ddd-es'
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify'
import type { CommandResponse } from '../shared/types.js'
import { DemoEventStore } from './event-store.js'
import { NoteRepository } from './notes/repository.js'
import { noteRoutes } from './notes/routes.js'
import { TodoRepository } from './todos/repository.js'
import { todoRoutes } from './todos/routes.js'
import { websocketPlugin } from './websocket.js'

interface CachedResponse {
  statusCode: number
  body: CommandResponse
  cachedAt: number
}

export interface AppContext {
  app: FastifyInstance
  eventStore: DemoEventStore
  todoRepo: TodoRepository
  noteRepo: NoteRepository
}

export function createApp(options?: { logLevel?: string }): AppContext {
  const app = Fastify({
    logger: {
      level: options?.logLevel ?? 'debug',
      transport: { target: 'pino-pretty' },
    },
  })

  logProvider.setLogger(app.log)

  const eventStore = new DemoEventStore()
  const todoRepo = new TodoRepository(eventStore)
  const noteRepo = new NoteRepository(eventStore)

  // --- Request deduplication cache ---

  const responseCache = new Map<string, CachedResponse>()
  const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

  const cacheCleanupTimer = setInterval(() => {
    const now = Date.now()
    for (const [key, value] of responseCache) {
      if (now - value.cachedAt > CACHE_TTL_MS) {
        responseCache.delete(key)
      }
    }
  }, 60 * 1000)
  cacheCleanupTimer.unref()

  app.addHook('onClose', async () => {
    clearInterval(cacheCleanupTimer)
  })

  // --- Request deduplication middleware ---

  async function checkRequestCache(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const requestId = request.headers['x-request-id']

    if (typeof requestId === 'string' && requestId.length > 0) {
      const cached = responseCache.get(requestId)
      if (cached) {
        request.log.info({ requestId }, 'Returning cached response for request')
        reply.code(cached.statusCode).send(cached.body)
      }
    }
  }

  function cacheResponse(
    request: FastifyRequest,
    reply: FastifyReply,
    response: CommandResponse,
  ): void {
    const requestId = request.headers['x-request-id']

    if (typeof requestId === 'string' && requestId.length > 0) {
      responseCache.set(requestId, {
        statusCode: reply.statusCode,
        body: response,
        cachedAt: Date.now(),
      })
    }
  }

  // --- API routes plugin ---

  async function apiRoutes(api: FastifyInstance): Promise<void> {
    api.addHook('preHandler', async (request, reply) => {
      if (request.method === 'POST') {
        await checkRequestCache(request, reply)
      }
    })

    api.register(todoRoutes(eventStore, todoRepo))
    api.register(noteRoutes(eventStore, noteRepo))

    api.addHook('onSend', async (request, reply, payload) => {
      if (request.method === 'POST' && typeof payload === 'string') {
        try {
          const response = JSON.parse(payload) as CommandResponse
          cacheResponse(request, reply, response)
        } catch {
          // Not JSON, skip caching
        }
      }
      return payload
    })

    api.get('/health', async () => {
      return { status: 'ok' }
    })

    api.post('/test/reset', async () => {
      eventStore.clear()
      todoRepo.clear()
      noteRepo.clear()
      responseCache.clear()
      return { status: 'ok' }
    })
  }

  app.register(websocket)
  app.register(websocketPlugin(eventStore))
  app.register(apiRoutes, { prefix: '/api' })

  return { app, eventStore, todoRepo, noteRepo }
}
