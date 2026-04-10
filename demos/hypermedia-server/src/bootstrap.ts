/**
 * Server bootstrap — wires up infrastructure, repositories, route plugins,
 * and Hydra API documentation serving.
 */

import { DemoEventStore, TempFileStore } from '@cqrs-toolkit/demo-base/common/server'
import type { CommandResponse } from '@cqrs-toolkit/demo-base/common/shared'
import { FileObjectRepository } from '@cqrs-toolkit/demo-base/file-objects/server'
import { NotebookRepository, NotebookService } from '@cqrs-toolkit/demo-base/notebooks/server'
import { NoteRepository } from '@cqrs-toolkit/demo-base/notes/server'
import { TodoRepository } from '@cqrs-toolkit/demo-base/todos/server'
import { createMetaPlugin } from '@cqrs-toolkit/hypermedia/dev-server'
import { hydraLinkHeader } from '@cqrs-toolkit/hypermedia/server'
import { int64Visitor, validatorProvider } from '@cqrs-toolkit/schema'
import multipart from '@fastify/multipart'
import websocket from '@fastify/websocket'
import { logProvider } from '@meticoeus/ddd-es'
import scalarUi from '@scalar/fastify-api-reference'
import { Ajv } from 'ajv'
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify'
import toolkitConfig from '../cqrs-toolkit.config.js'
import { fileObjectRoutes } from './file-objects/routes.js'
import { uploadRoute } from './file-objects/upload-route.js'
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

const SERVER_PORT = 3002
const APIDOC_URL = `http://localhost:${SERVER_PORT}/api/meta/apidoc`

export function createApp(options?: { logLevel?: string }): AppContext {
  const app = Fastify({
    logger: {
      level: options?.logLevel ?? 'debug',
      transport: { target: 'pino-pretty' },
    },
  })

  logProvider.setLogger(app.log)

  // Bootstrap validation — required before any CommandPlanner.parse() call
  const ajv = new Ajv({ allErrors: true })
  validatorProvider.setAjv(ajv, [int64Visitor])

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

  // --- Route registration ---

  async function routes(server: FastifyInstance): Promise<void> {
    server.register(hydraLinkHeader, { apiDocUrl: APIDOC_URL })

    server.addHook('preHandler', async (request, reply) => {
      if (request.method === 'POST') {
        await checkRequestCache(request, reply)
      }
    })

    server.addHook('onSend', async (request, reply, data) => {
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

    // Domain routes (paths derived from HydraDoc surfaces and representations)
    server.register(todoRoutes(eventStore, todoRepo))
    server.register(notebookRoutes(eventStore, notebookRepo, notebookService))
    server.register(noteRoutes(eventStore, noteRepo, notebookRepo))
    server.register(
      fileObjectRoutes(
        eventStore,
        fileObjectRepo,
        noteRepo,
        fileStore,
        `http://localhost:${SERVER_PORT}`,
      ),
    )

    // Infrastructure routes
    server.register(sessionRoutes(userStore), { prefix: '/api/auth' })
    server.register(createMetaPlugin({ config: toolkitConfig.server }))

    server.get('/api/health', async () => {
      return { status: 'ok' }
    })

    server.post('/api/test/reset', async () => {
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

    server.post('/api/test/ws-pause', async () => {
      wsControl.pause()
      return { status: 'ok' }
    })

    server.post('/api/test/ws-resume', async () => {
      wsControl.resume()
      return { status: 'ok' }
    })
  }

  const { plugin: wsPlugin, control: wsControl } = websocketPlugin(eventStore, userStore)

  app.register(multipart, { limits: { fileSize: 1024 * 1024 * 100 } })
  app.register(websocket)
  app.register(wsPlugin)
  app.register(routes)
  app.register(uploadRoute(fileObjectRepo, noteRepo, fileStore))
  app.register(scalarUi, {
    routePrefix: '/docs',
    configuration: {
      url: '/api/meta/openapi',
    },
  })

  return { app, eventStore, todoRepo, noteRepo, notebookRepo, fileObjectRepo, fileStore, userStore }
}
