import type { CommandSuccessResponse } from '@cqrs-toolkit/demo-base/common/shared'
import type { Notebook } from '@cqrs-toolkit/demo-base/notebooks/server'
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

describe('POST /api/notebooks/commands', () => {
  describe('CreateNotebook', () => {
    it('creates a notebook and returns the event', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/notebooks/commands',
        payload: { type: 'CreateNotebook', data: { name: 'My Notebook' } },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json<CommandSuccessResponse>()
      expect(body.id).toBeDefined()
      expect(body.nextExpectedRevision).toBe('0')
      expect(body.events).toHaveLength(1)
      expect(body.events[0]?.type).toBe('NotebookCreated')
      expect(body.events[0]?.data).toMatchObject({ name: 'My Notebook' })
    })

    it('rejects empty name', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/notebooks/commands',
        payload: { type: 'CreateNotebook', data: { name: '' } },
      })

      expect(res.statusCode).toBe(400)
    })

    it('rejects missing name field', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/notebooks/commands',
        payload: { type: 'CreateNotebook', data: {} },
      })

      expect(res.statusCode).toBe(400)
    })
  })

  describe('UpdateNotebookName', () => {
    it('updates name on an existing notebook', async () => {
      const { id, nextExpectedRevision } = await createNotebook('Original Name')

      const res = await app.inject({
        method: 'POST',
        url: '/api/notebooks/commands',
        payload: {
          type: 'UpdateNotebookName',
          data: { id, name: 'New Name' },
          revision: nextExpectedRevision,
        },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json<CommandSuccessResponse>()
      expect(body.events[0]?.type).toBe('NotebookNameUpdated')
      expect(body.events[0]?.data).toMatchObject({ name: 'New Name' })
    })

    it('returns 404 for nonexistent notebook', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/notebooks/commands',
        payload: {
          type: 'UpdateNotebookName',
          data: { id: 'nonexistent', name: 'x' },
          revision: '0',
        },
      })

      expect(res.statusCode).toBe(404)
    })
  })

  describe('DeleteNotebook', () => {
    it('deletes an existing notebook', async () => {
      const { id, nextExpectedRevision } = await createNotebook('To be deleted')

      const res = await app.inject({
        method: 'POST',
        url: '/api/notebooks/commands',
        payload: {
          type: 'DeleteNotebook',
          data: { id },
          revision: nextExpectedRevision,
        },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json<CommandSuccessResponse>()
      expect(body.events[0]?.type).toBe('NotebookDeleted')

      const getRes = await app.inject({ method: 'GET', url: `/api/notebooks/${id}` })
      expect(getRes.statusCode).toBe(404)
    })

    it('returns 500 for nonexistent notebook', async () => {
      // NotebookService.deleteNotebook throws Error (not a domain exception)
      // for nonexistent notebooks — propagates as 500.
      const res = await app.inject({
        method: 'POST',
        url: '/api/notebooks/commands',
        payload: { type: 'DeleteNotebook', data: { id: 'nonexistent' }, revision: '0' },
      })

      expect(res.statusCode).toBe(500)
    })
  })

  it('returns 400 for unknown command type', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/notebooks/commands',
      payload: { type: 'FlyToMoon', data: {} },
    })

    expect(res.statusCode).toBe(400)
  })
})

describe('GET /api/notebooks', () => {
  it('lists notebooks sorted by createdAt', async () => {
    const freshApp = await createFreshApp()
    const { id: id1 } = await createNotebookOn(freshApp, 'First')
    const { id: id2 } = await createNotebookOn(freshApp, 'Second')

    const res = await freshApp.inject({ method: 'GET', url: '/api/notebooks' })

    expect(res.statusCode).toBe(200)
    const body = res.json<{ items: Notebook[]; nextCursor: string | null }>()
    expect(body.items).toHaveLength(2)
    expect(body.items[0]?.id).toBe(id1)
    expect(body.items[1]?.id).toBe(id2)
    expect(body.nextCursor).toBeNull()

    await freshApp.close()
  })

  it('supports cursor-based pagination', async () => {
    const freshApp = await createFreshApp()
    await createNotebookOn(freshApp, 'A')
    const { id: idB } = await createNotebookOn(freshApp, 'B')
    await createNotebookOn(freshApp, 'C')

    const res = await freshApp.inject({
      method: 'GET',
      url: `/api/notebooks?limit=1&cursor=${idB}`,
    })

    const body = res.json<{ items: Notebook[]; nextCursor: string | null }>()
    expect(body.items).toHaveLength(1)
    expect(body.items[0]?.name).toBe('C')

    await freshApp.close()
  })
})

describe('GET /api/notebooks/:id', () => {
  it('returns a notebook by id with latestRevision', async () => {
    const { id } = await createNotebook('Fetch me')

    const res = await app.inject({ method: 'GET', url: `/api/notebooks/${id}` })

    expect(res.statusCode).toBe(200)
    const body = res.json<Notebook>()
    expect(body.id).toBe(id)
    expect(body.name).toBe('Fetch me')
    expect(body.latestRevision).toBe('0')
  })

  it('returns 404 for nonexistent notebook', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/notebooks/nonexistent' })
    expect(res.statusCode).toBe(404)
  })
})

describe('GET /api/notebooks/:id/events', () => {
  it('returns the event stream for a notebook', async () => {
    const { id, nextExpectedRevision } = await createNotebook('Event stream test')

    await app.inject({
      method: 'POST',
      url: '/api/notebooks/commands',
      payload: {
        type: 'UpdateNotebookName',
        data: { id, name: 'Updated' },
        revision: nextExpectedRevision,
      },
    })

    const res = await app.inject({ method: 'GET', url: `/api/notebooks/${id}/events` })

    expect(res.statusCode).toBe(200)
    const body = res.json<{ events: unknown[] }>()
    expect(body.events).toHaveLength(2)
  })
})

describe('GET /api/events/notebooks', () => {
  it('returns global notebook events', async () => {
    const freshApp = await createFreshApp()
    await createNotebookOn(freshApp, 'Global event test')

    const res = await freshApp.inject({ method: 'GET', url: '/api/events/notebooks' })

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

async function createNotebook(name: string): Promise<CreateResult> {
  return createNotebookOn(app, name)
}

async function createNotebookOn(instance: FastifyInstance, name: string): Promise<CreateResult> {
  const res = await instance.inject({
    method: 'POST',
    url: '/api/notebooks/commands',
    payload: { type: 'CreateNotebook', data: { name } },
  })
  const body = res.json<CommandSuccessResponse>()
  return { id: body.id, nextExpectedRevision: body.nextExpectedRevision }
}

async function createFreshApp(): Promise<FastifyInstance> {
  const { app: freshApp } = createApp({ logLevel: 'silent' })
  await freshApp.ready()
  return freshApp
}
