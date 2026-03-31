/**
 * Server bootstrap — wires up infrastructure, repositories, and route plugins.
 *
 * Returns a configured Fastify instance ready for .listen() or .inject().
 */

import { DemoEventStore, TempFileStore } from '@cqrs-toolkit/demo-base/common/server'
import type { CommandResponse } from '@cqrs-toolkit/demo-base/common/shared'
import { FileObjectRepository } from '@cqrs-toolkit/demo-base/file-objects/server'
import { NotebookRepository, NotebookService } from '@cqrs-toolkit/demo-base/notebooks/server'
import { NoteRepository } from '@cqrs-toolkit/demo-base/notes/server'
import { TodoRepository } from '@cqrs-toolkit/demo-base/todos/server'
import multipart from '@fastify/multipart'
import websocket from '@fastify/websocket'
import { logProvider } from '@meticoeus/ddd-es'
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify'
import { fileObjectRoutes } from './file-objects/routes.js'
import { notebookRoutes } from './notebooks/routes.js'
import { noteRoutes } from './notes/routes.js'
import { FakeUserStore, sessionRoutes } from './session/routes.js'
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
  notebookRepo: NotebookRepository
  fileObjectRepo: FileObjectRepository
  fileStore: TempFileStore
  userStore: FakeUserStore
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
  const notebookRepo = new NotebookRepository(eventStore)
  const fileObjectRepo = new FileObjectRepository(eventStore, noteRepo)
  const notebookService = new NotebookService(notebookRepo, noteRepo)
  const fileStore = new TempFileStore()
  const userStore = new FakeUserStore()

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
    fileStore.cleanup()
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

    api.register(sessionRoutes(userStore), { prefix: '/auth' })
    api.register(todoRoutes(eventStore, todoRepo))
    api.register(notebookRoutes(eventStore, notebookRepo, notebookService))
    api.register(noteRoutes(eventStore, noteRepo, notebookRepo))
    api.register(fileObjectRoutes(eventStore, fileObjectRepo, noteRepo, fileStore))

    api.addHook('onSend', async (request, reply, data) => {
      if (request.method === 'POST' && typeof data === 'string') {
        try {
          const response = JSON.parse(data) as CommandResponse
          cacheResponse(request, reply, response)
        } catch {
          // Not JSON, skip caching
        }
      }
      return data
    })

    api.get('/health', async () => {
      return { status: 'ok' }
    })

    api.post('/test/reset', async () => {
      eventStore.clear()
      todoRepo.clear()
      noteRepo.clear()
      notebookRepo.clear()
      fileObjectRepo.clear()
      fileStore.clear()
      userStore.clear()
      responseCache.clear()
      wsControl.resume()
      return { status: 'ok' }
    })

    api.post('/test/ws-pause', async () => {
      wsControl.pause()
      return { status: 'ok' }
    })

    api.post('/test/ws-resume', async () => {
      wsControl.resume()
      return { status: 'ok' }
    })
  }

  const { plugin: wsPlugin, control: wsControl } = websocketPlugin(eventStore, userStore)

  app.register(multipart)
  app.register(websocket)
  app.register(wsPlugin)
  app.register(apiRoutes, { prefix: '/api' })

  return { app, eventStore, todoRepo, noteRepo, notebookRepo, fileObjectRepo, fileStore, userStore }
}
