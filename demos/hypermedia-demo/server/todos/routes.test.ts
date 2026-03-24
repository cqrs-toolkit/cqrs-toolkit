import type { CommandSuccessResponse } from '@cqrs-toolkit/demo-base/common/shared'
import type { Todo } from '@cqrs-toolkit/demo-base/todos/shared'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../bootstrap.js'

let app: FastifyInstance

beforeAll(async () => {
  ;({ app } = createApp({ logLevel: 'silent' }))
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

describe('POST /api/todos (create)', () => {
  it('creates a todo and returns the event', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/todos',
      payload: { content: 'Buy milk' },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json<CommandSuccessResponse>()
    expect(body.id).toBeDefined()
    expect(body.nextExpectedRevision).toBe('0')
    expect(body.events).toHaveLength(1)
    expect(body.events[0]?.type).toBe('TodoCreated')
    expect(body.events[0]?.data).toMatchObject({
      content: 'Buy milk',
      status: 'pending',
    })
  })

  it('rejects empty content', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/todos',
      payload: { content: '' },
    })

    expect(res.statusCode).toBe(400)
  })

  it('rejects missing content field', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/todos',
      payload: {},
    })

    expect(res.statusCode).toBe(400)
  })
})

describe('POST /api/todos/:id/command', () => {
  describe('updateContent', () => {
    it('updates content on an existing todo', async () => {
      const { id: todoId, nextExpectedRevision } = await createTodo('Original content')

      const res = await app.inject({
        method: 'POST',
        url: `/api/todos/${todoId}/command`,
        payload: {
          type: 'updateContent',
          data: { content: 'Updated content' },
          revision: nextExpectedRevision,
        },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json<CommandSuccessResponse>()
      expect(body.events[0]?.type).toBe('TodoContentUpdated')
      expect(body.events[0]?.data).toMatchObject({ content: 'Updated content' })
    })

    it('returns 404 for nonexistent todo', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/todos/nonexistent/command',
        payload: {
          type: 'updateContent',
          data: { content: 'x' },
          revision: '0',
        },
      })

      expect(res.statusCode).toBe(404)
      expect(res.json()).toMatchObject({ message: 'Todo not found' })
    })
  })

  describe('changeStatus', () => {
    it('changes status on an existing todo', async () => {
      const { id: todoId, nextExpectedRevision } = await createTodo('Status test')

      const res = await app.inject({
        method: 'POST',
        url: `/api/todos/${todoId}/command`,
        payload: {
          type: 'changeStatus',
          data: { status: 'in_progress' },
          revision: nextExpectedRevision,
        },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json<CommandSuccessResponse>()
      expect(body.events[0]?.type).toBe('TodoStatusChanged')
      expect(body.events[0]?.data).toMatchObject({ status: 'in_progress' })
    })

    it('rejects invalid status value', async () => {
      const { id: todoId, nextExpectedRevision } = await createTodo('Invalid status test')

      const res = await app.inject({
        method: 'POST',
        url: `/api/todos/${todoId}/command`,
        payload: {
          type: 'changeStatus',
          data: { status: 'invalid' },
          revision: nextExpectedRevision,
        },
      })

      expect(res.statusCode).toBe(400)
    })

    it('returns 404 for nonexistent todo', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/todos/nonexistent/command',
        payload: {
          type: 'changeStatus',
          data: { status: 'completed' },
          revision: '0',
        },
      })

      expect(res.statusCode).toBe(404)
    })
  })

  describe('delete', () => {
    it('deletes an existing todo', async () => {
      const { id: todoId, nextExpectedRevision } = await createTodo('To be deleted')

      const res = await app.inject({
        method: 'POST',
        url: `/api/todos/${todoId}/command`,
        payload: {
          type: 'delete',
          data: {},
          revision: nextExpectedRevision,
        },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json<CommandSuccessResponse>()
      expect(body.events[0]?.type).toBe('TodoDeleted')

      // Verify it's gone from the read model
      const getRes = await app.inject({ method: 'GET', url: `/api/todos/${todoId}` })
      expect(getRes.statusCode).toBe(404)
    })

    it('returns 404 for nonexistent todo', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/todos/nonexistent/command',
        payload: { type: 'delete', data: {}, revision: '0' },
      })

      expect(res.statusCode).toBe(404)
    })
  })

  it('returns 400 for unknown command type', async () => {
    const { id: todoId } = await createTodo('Unknown command test')

    const res = await app.inject({
      method: 'POST',
      url: `/api/todos/${todoId}/command`,
      payload: { type: 'flyToMoon', data: {} },
    })

    expect(res.statusCode).toBe(400)
  })
})

describe('GET /api/todos', () => {
  describe('application/json', () => {
    it('lists todos sorted by createdAt', async () => {
      const freshApp = await createFreshApp()
      const { id: id1 } = await createTodoOn(freshApp, 'First')
      const { id: id2 } = await createTodoOn(freshApp, 'Second')

      const res = await freshApp.inject({
        method: 'GET',
        url: '/api/todos',
        headers: { accept: 'application/json' },
      })

      expect(res.statusCode).toBe(200)
      expect(res.headers['content-type']).toContain('application/json')
      const body = res.json<{ entities: Todo[]; nextCursor: string | null }>()
      expect(body.entities).toHaveLength(2)
      expect(body.entities[0]?.id).toBe(id1)
      expect(body.entities[1]?.id).toBe(id2)
      expect(body.nextCursor).toBeNull()

      await freshApp.close()
    })

    it('supports cursor-based pagination', async () => {
      const freshApp = await createFreshApp()
      await createTodoOn(freshApp, 'A')
      const { id: idB } = await createTodoOn(freshApp, 'B')
      await createTodoOn(freshApp, 'C')

      const res = await freshApp.inject({
        method: 'GET',
        url: `/api/todos?limit=1&cursor=${idB}`,
        headers: { accept: 'application/json' },
      })

      const body = res.json<{ entities: Todo[]; nextCursor: string | null }>()
      expect(body.entities).toHaveLength(1)
      expect(body.entities[0]?.content).toBe('C')

      await freshApp.close()
    })
  })

  describe('application/hal+json', () => {
    it('lists todos as HAL collection', async () => {
      const freshApp = await createFreshApp()
      const { id: id1 } = await createTodoOn(freshApp, 'First')
      const { id: id2 } = await createTodoOn(freshApp, 'Second')

      const res = await freshApp.inject({
        method: 'GET',
        url: '/api/todos',
        headers: { accept: 'application/hal+json' },
      })

      expect(res.statusCode).toBe(200)
      expect(res.headers['content-type']).toContain('application/hal+json')
      const body = res.json()
      expect(body._links).toBeDefined()
      expect(body._links.self).toBeDefined()
      expect(body._embedded).toBeDefined()
      const items = body._embedded.item as Record<string, unknown>[]
      expect(items).toHaveLength(2)
      expect(items[0]?.id).toBe(id1)
      expect(items[1]?.id).toBe(id2)

      await freshApp.close()
    })

    it('pages through all items using next links', async () => {
      const freshApp = await createFreshApp()
      await createTodoOn(freshApp, 'A')
      await createTodoOn(freshApp, 'B')
      await createTodoOn(freshApp, 'C')

      const collected: string[] = []
      let url = '/api/todos?limit=1'

      while (url) {
        const res = await freshApp.inject({
          method: 'GET',
          url,
          headers: { accept: 'application/hal+json' },
        })
        expect(res.statusCode).toBe(200)

        const body = res.json()
        const items = body._embedded.item as Record<string, unknown>[]
        for (const item of items) {
          collected.push(item['content'] as string)
        }

        const next = body._links.next as { href: string } | undefined
        url = next ? next.href : ''
      }

      expect(collected).toEqual(['A', 'B', 'C'])

      await freshApp.close()
    })
  })
})

describe('GET /api/todos/:id', () => {
  it('returns a todo as JSON', async () => {
    const { id: todoId } = await createTodo('Fetch me')

    const res = await app.inject({
      method: 'GET',
      url: `/api/todos/${todoId}`,
      headers: { accept: 'application/json' },
    })

    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('application/json')
    const body = res.json<Todo>()
    expect(body.id).toBe(todoId)
    expect(body.content).toBe('Fetch me')
    expect(body.status).toBe('pending')
    expect(body.latestRevision).toBe('0')
  })

  it('returns a todo as HAL', async () => {
    const { id: todoId } = await createTodo('HAL me')

    const res = await app.inject({
      method: 'GET',
      url: `/api/todos/${todoId}`,
      headers: { accept: 'application/hal+json' },
    })

    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('application/hal+json')
    const body = res.json()
    expect(body._links).toBeDefined()
    expect(body._links.self).toBeDefined()
    expect(body.id).toBe(todoId)
    expect(body.content).toBe('HAL me')
  })

  it('returns 404 for nonexistent todo', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/todos/nonexistent',
      headers: { accept: 'application/json' },
    })

    expect(res.statusCode).toBe(404)
  })
})

describe('GET /api/todos/:id/events', () => {
  it('returns the event stream for a todo', async () => {
    const { id: todoId, nextExpectedRevision } = await createTodo('Event stream test')

    // Make a second event
    await app.inject({
      method: 'POST',
      url: `/api/todos/${todoId}/command`,
      payload: {
        type: 'changeStatus',
        data: { status: 'completed' },
        revision: nextExpectedRevision,
      },
    })

    const res = await app.inject({
      method: 'GET',
      url: `/api/todos/${todoId}/events`,
      headers: { accept: 'application/json' },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json<{ entities: unknown[] }>()
    expect(body.entities).toHaveLength(2)
  })

  it('returns item events as HAL', async () => {
    const { id: todoId } = await createTodo('HAL events test')

    const res = await app.inject({
      method: 'GET',
      url: `/api/todos/${todoId}/events`,
      headers: { accept: 'application/hal+json' },
    })

    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('application/hal+json')
    const body = res.json()
    expect(body._links).toBeDefined()
    expect(body._embedded).toBeDefined()
  })
})

describe('GET /api/events/todos', () => {
  it('returns global todo events as JSON', async () => {
    const freshApp = await createFreshApp()
    await createTodoOn(freshApp, 'Global event test')

    const res = await freshApp.inject({
      method: 'GET',
      url: '/api/events/todos',
      headers: { accept: 'application/json' },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json<{ entities: unknown[] }>()
    expect(body.entities.length).toBeGreaterThanOrEqual(1)

    await freshApp.close()
  })

  it('returns global todo events as HAL', async () => {
    const freshApp = await createFreshApp()
    await createTodoOn(freshApp, 'HAL global event test')

    const res = await freshApp.inject({
      method: 'GET',
      url: '/api/events/todos',
      headers: { accept: 'application/hal+json' },
    })

    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('application/hal+json')
    const body = res.json()
    expect(body._links).toBeDefined()
    expect(body._embedded).toBeDefined()

    await freshApp.close()
  })
})

// --- Helpers ---

interface CreateResult {
  id: string
  nextExpectedRevision: string
}

async function createTodo(content: string): Promise<CreateResult> {
  return createTodoOn(app, content)
}

async function createTodoOn(instance: FastifyInstance, content: string): Promise<CreateResult> {
  const res = await instance.inject({
    method: 'POST',
    url: '/api/todos',
    payload: { content },
  })
  const body = res.json<CommandSuccessResponse>()
  return { id: body.id, nextExpectedRevision: body.nextExpectedRevision }
}

async function createFreshApp(): Promise<FastifyInstance> {
  const { app: freshApp } = createApp({ logLevel: 'silent' })
  await freshApp.ready()
  return freshApp
}
