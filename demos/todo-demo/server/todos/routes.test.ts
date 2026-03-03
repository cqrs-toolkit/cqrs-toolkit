import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Todo } from '../../shared/todos/types.js'
import type { CommandSuccessResponse } from '../../shared/types.js'
import { createApp } from '../bootstrap.js'

let app: FastifyInstance

beforeAll(async () => {
  ;({ app } = createApp({ logLevel: 'silent' }))
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

describe('POST /api/todos/commands', () => {
  describe('CreateTodo', () => {
    it('creates a todo and returns the event', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/todos/commands',
        payload: { type: 'CreateTodo', payload: { content: 'Buy milk' } },
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
        url: '/api/todos/commands',
        payload: { type: 'CreateTodo', payload: { content: '' } },
      })

      expect(res.statusCode).toBe(400)
      expect(res.json()).toMatchObject({ message: 'Invalid payload' })
    })

    it('rejects missing content field', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/todos/commands',
        payload: { type: 'CreateTodo', payload: {} },
      })

      expect(res.statusCode).toBe(400)
    })
  })

  describe('UpdateTodoContent', () => {
    it('updates content on an existing todo', async () => {
      const { id: todoId, nextExpectedRevision } = await createTodo('Original content')

      const res = await app.inject({
        method: 'POST',
        url: '/api/todos/commands',
        payload: {
          type: 'UpdateTodoContent',
          payload: { id: todoId, content: 'Updated content', revision: nextExpectedRevision },
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
        url: '/api/todos/commands',
        payload: {
          type: 'UpdateTodoContent',
          payload: { id: 'nonexistent', content: 'x', revision: '0' },
        },
      })

      expect(res.statusCode).toBe(404)
      expect(res.json()).toMatchObject({ message: 'Todo not found' })
    })
  })

  describe('ChangeTodoStatus', () => {
    it('changes status on an existing todo', async () => {
      const { id: todoId, nextExpectedRevision } = await createTodo('Status test')

      const res = await app.inject({
        method: 'POST',
        url: '/api/todos/commands',
        payload: {
          type: 'ChangeTodoStatus',
          payload: { id: todoId, status: 'in_progress', revision: nextExpectedRevision },
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
        url: '/api/todos/commands',
        payload: {
          type: 'ChangeTodoStatus',
          payload: { id: todoId, status: 'invalid', revision: nextExpectedRevision },
        },
      })

      expect(res.statusCode).toBe(400)
    })

    it('returns 404 for nonexistent todo', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/todos/commands',
        payload: {
          type: 'ChangeTodoStatus',
          payload: { id: 'nonexistent', status: 'completed', revision: '0' },
        },
      })

      expect(res.statusCode).toBe(404)
    })
  })

  describe('DeleteTodo', () => {
    it('deletes an existing todo', async () => {
      const { id: todoId, nextExpectedRevision } = await createTodo('To be deleted')

      const res = await app.inject({
        method: 'POST',
        url: '/api/todos/commands',
        payload: {
          type: 'DeleteTodo',
          payload: { id: todoId, revision: nextExpectedRevision },
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
        url: '/api/todos/commands',
        payload: { type: 'DeleteTodo', payload: { id: 'nonexistent', revision: '0' } },
      })

      expect(res.statusCode).toBe(404)
    })
  })

  it('returns 400 for unknown command type', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/todos/commands',
      payload: { type: 'FlyToMoon', payload: {} },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json()).toMatchObject({ message: 'Unknown command type' })
  })
})

describe('GET /api/todos', () => {
  it('lists todos sorted by createdAt', async () => {
    const freshApp = await createFreshApp()
    const { id: id1 } = await createTodoOn(freshApp, 'First')
    const { id: id2 } = await createTodoOn(freshApp, 'Second')

    const res = await freshApp.inject({ method: 'GET', url: '/api/todos' })

    expect(res.statusCode).toBe(200)
    const body = res.json<{ items: Todo[]; nextCursor: string | null }>()
    expect(body.items).toHaveLength(2)
    expect(body.items[0]?.id).toBe(id1)
    expect(body.items[1]?.id).toBe(id2)
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
    })

    const body = res.json<{ items: Todo[]; nextCursor: string | null }>()
    expect(body.items).toHaveLength(1)
    expect(body.items[0]?.content).toBe('C')

    await freshApp.close()
  })
})

describe('GET /api/todos/:id', () => {
  it('returns a todo by id with latestRevision', async () => {
    const { id: todoId } = await createTodo('Fetch me')

    const res = await app.inject({ method: 'GET', url: `/api/todos/${todoId}` })

    expect(res.statusCode).toBe(200)
    const body = res.json<Todo>()
    expect(body.id).toBe(todoId)
    expect(body.content).toBe('Fetch me')
    expect(body.status).toBe('pending')
    expect(body.latestRevision).toBe('0')
  })

  it('returns 404 for nonexistent todo', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/todos/nonexistent' })

    expect(res.statusCode).toBe(404)
  })
})

describe('GET /api/todos/:id/events', () => {
  it('returns the event stream for a todo', async () => {
    const { id: todoId, nextExpectedRevision } = await createTodo('Event stream test')

    // Make a second event
    await app.inject({
      method: 'POST',
      url: '/api/todos/commands',
      payload: {
        type: 'ChangeTodoStatus',
        payload: { id: todoId, status: 'completed', revision: nextExpectedRevision },
      },
    })

    const res = await app.inject({ method: 'GET', url: `/api/todos/${todoId}/events` })

    expect(res.statusCode).toBe(200)
    const body = res.json<{ events: unknown[] }>()
    expect(body.events).toHaveLength(2)
  })
})

describe('GET /api/events/todos', () => {
  it('returns global todo events', async () => {
    const freshApp = await createFreshApp()
    await createTodoOn(freshApp, 'Global event test')

    const res = await freshApp.inject({ method: 'GET', url: '/api/events/todos' })

    expect(res.statusCode).toBe(200)
    const body = res.json<{ events: unknown[]; nextCursor: string | null }>()
    expect(body.events.length).toBeGreaterThanOrEqual(1)

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
    url: '/api/todos/commands',
    payload: { type: 'CreateTodo', payload: { content } },
  })
  const body = res.json<CommandSuccessResponse>()
  return { id: body.id, nextExpectedRevision: body.nextExpectedRevision }
}

async function createFreshApp(): Promise<FastifyInstance> {
  const { app: freshApp } = createApp({ logLevel: 'silent' })
  await freshApp.ready()
  return freshApp
}
