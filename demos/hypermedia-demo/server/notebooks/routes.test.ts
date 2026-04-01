import type { CommandSuccessResponse } from '@cqrs-toolkit/demo-base/common/shared'
import type { Notebook } from '@cqrs-toolkit/demo-base/notebooks/shared'
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

describe('POST /api/notebooks (create)', () => {
  it('creates a notebook and returns the event', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/notebooks',
      payload: { name: 'My Notebook' },
      headers: commandHeaders(),
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
      url: '/api/notebooks',
      payload: { name: '' },
      headers: commandHeaders(),
    })

    expect(res.statusCode).toBe(400)
  })

  it('rejects missing name field', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/notebooks',
      payload: {},
      headers: commandHeaders(),
    })

    expect(res.statusCode).toBe(400)
  })
})

describe('POST /api/notebooks/:id/command', () => {
  describe('updateName', () => {
    it('updates name on an existing notebook', async () => {
      const { id, nextExpectedRevision } = await createNotebook('Original Name')

      const res = await app.inject({
        method: 'POST',
        url: `/api/notebooks/${id}/command`,
        payload: {
          type: 'updateName',
          data: { name: 'New Name' },
          revision: nextExpectedRevision,
        },
        headers: commandHeaders(),
      })

      expect(res.statusCode).toBe(200)
      const body = res.json<CommandSuccessResponse>()
      expect(body.events[0]?.type).toBe('NotebookNameUpdated')
      expect(body.events[0]?.data).toMatchObject({ name: 'New Name' })
    })

    it('returns 404 for nonexistent notebook', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/notebooks/nonexistent/command',
        payload: {
          type: 'updateName',
          data: { name: 'x' },
          revision: '0',
        },
        headers: commandHeaders(),
      })

      expect(res.statusCode).toBe(404)
    })
  })

  describe('delete', () => {
    it('deletes an existing notebook', async () => {
      const { id, nextExpectedRevision } = await createNotebook('To be deleted')

      const res = await app.inject({
        method: 'POST',
        url: `/api/notebooks/${id}/command`,
        payload: {
          type: 'delete',
          data: {},
          revision: nextExpectedRevision,
        },
        headers: commandHeaders(),
      })

      expect(res.statusCode).toBe(200)
      const body = res.json<CommandSuccessResponse>()
      expect(body.events[0]?.type).toBe('NotebookDeleted')

      const getRes = await app.inject({
        method: 'GET',
        url: `/api/notebooks/${id}`,
        headers: { accept: 'application/json' },
      })
      expect(getRes.statusCode).toBe(404)
    })

    it('returns 500 for nonexistent notebook', async () => {
      // NotebookService.deleteNotebook throws Error (not a domain exception)
      // for nonexistent notebooks — propagates as 500.
      const res = await app.inject({
        method: 'POST',
        url: '/api/notebooks/nonexistent/command',
        payload: { type: 'delete', data: {}, revision: '0' },
        headers: commandHeaders(),
      })

      expect(res.statusCode).toBe(500)
    })
  })

  it('returns 400 for unknown command type', async () => {
    const { id } = await createNotebook('Unknown command test')

    const res = await app.inject({
      method: 'POST',
      url: `/api/notebooks/${id}/command`,
      payload: { type: 'flyToMoon', data: {} },
      headers: commandHeaders(),
    })

    expect(res.statusCode).toBe(400)
  })
})

describe('event metadata propagation', () => {
  it('propagates x-request-id and x-command-id to created events', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/notebooks',
      payload: { name: 'Metadata test' },
      headers: { 'x-request-id': 'req-meta-1', 'x-command-id': 'cmd-meta-1' },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json<CommandSuccessResponse>()
    expect(body.events[0]?.metadata).toMatchObject({
      correlationId: 'req-meta-1',
      commandId: 'cmd-meta-1',
    })
  })

  it('propagates headers on command envelope', async () => {
    const { id, nextExpectedRevision } = await createNotebook('Meta cmd test')

    const res = await app.inject({
      method: 'POST',
      url: `/api/notebooks/${id}/command`,
      payload: {
        type: 'updateName',
        data: { name: 'Updated meta' },
        revision: nextExpectedRevision,
      },
      headers: { 'x-request-id': 'req-meta-2', 'x-command-id': 'cmd-meta-2' },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json<CommandSuccessResponse>()
    expect(body.events[0]?.metadata).toMatchObject({
      correlationId: 'req-meta-2',
      commandId: 'cmd-meta-2',
    })
  })

  it('rejects command without required headers', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/notebooks',
      payload: { name: 'No headers' },
    })

    expect(res.statusCode).toBe(400)
  })
})

describe('GET /api/notebooks', () => {
  describe('application/json', () => {
    it('lists notebooks sorted by createdAt', async () => {
      const freshApp = await createFreshApp()
      const { id: id1 } = await createNotebookOn(freshApp, 'First')
      const { id: id2 } = await createNotebookOn(freshApp, 'Second')

      const res = await freshApp.inject({
        method: 'GET',
        url: '/api/notebooks',
        headers: { accept: 'application/json' },
      })

      expect(res.statusCode).toBe(200)
      expect(res.headers['content-type']).toContain('application/json')
      const body = res.json<{ entities: Notebook[] }>()
      expect(body.entities).toHaveLength(2)
      expect(body.entities[0]?.id).toBe(id1)
      expect(body.entities[1]?.id).toBe(id2)

      await freshApp.close()
    })
  })

  describe('application/hal+json', () => {
    it('lists notebooks as HAL collection', async () => {
      const freshApp = await createFreshApp()
      await createNotebookOn(freshApp, 'First')
      await createNotebookOn(freshApp, 'Second')

      const res = await freshApp.inject({
        method: 'GET',
        url: '/api/notebooks',
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

      await freshApp.close()
    })

    it('pages through all items using next links', async () => {
      const freshApp = await createFreshApp()
      await createNotebookOn(freshApp, 'A')
      await createNotebookOn(freshApp, 'B')
      await createNotebookOn(freshApp, 'C')

      const collected: string[] = []
      let url = '/api/notebooks?limit=1'

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
          collected.push(item['name'] as string)
        }

        const next = body._links.next as { href: string } | undefined
        url = next ? next.href : ''
      }

      expect(collected).toEqual(['A', 'B', 'C'])

      await freshApp.close()
    })
  })
})

describe('GET /api/notebooks/:id', () => {
  it('returns a notebook as JSON', async () => {
    const { id } = await createNotebook('Fetch me')

    const res = await app.inject({
      method: 'GET',
      url: `/api/notebooks/${id}`,
      headers: { accept: 'application/json' },
    })

    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('application/json')
    const body = res.json<Notebook>()
    expect(body.id).toBe(id)
    expect(body.name).toBe('Fetch me')
    expect(body.latestRevision).toBe('0')
  })

  it('returns a notebook as HAL', async () => {
    const { id } = await createNotebook('HAL me')

    const res = await app.inject({
      method: 'GET',
      url: `/api/notebooks/${id}`,
      headers: { accept: 'application/hal+json' },
    })

    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('application/hal+json')
    const body = res.json()
    expect(body._links).toBeDefined()
    expect(body.id).toBe(id)
    expect(body.name).toBe('HAL me')
  })

  it('returns 404 for nonexistent notebook', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/notebooks/nonexistent',
      headers: { accept: 'application/json' },
    })
    expect(res.statusCode).toBe(404)
  })
})

describe('GET /api/notebooks/:id/events', () => {
  it('returns item events as JSON', async () => {
    const { id, nextExpectedRevision } = await createNotebook('Event stream test')

    await app.inject({
      method: 'POST',
      url: `/api/notebooks/${id}/command`,
      payload: {
        type: 'updateName',
        data: { name: 'Updated' },
        revision: nextExpectedRevision,
      },
      headers: commandHeaders(),
    })

    const res = await app.inject({
      method: 'GET',
      url: `/api/notebooks/${id}/events`,
      headers: { accept: 'application/json' },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json<{ entities: unknown[] }>()
    expect(body.entities).toHaveLength(2)
  })

  it('returns item events as HAL', async () => {
    const { id } = await createNotebook('HAL events test')

    const res = await app.inject({
      method: 'GET',
      url: `/api/notebooks/${id}/events`,
      headers: { accept: 'application/hal+json' },
    })

    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('application/hal+json')
    const body = res.json()
    expect(body._links).toBeDefined()
    expect(body._embedded).toBeDefined()
  })
})

describe('GET /api/events/notebooks', () => {
  it('returns global events as JSON', async () => {
    const freshApp = await createFreshApp()
    await createNotebookOn(freshApp, 'Global event test')

    const res = await freshApp.inject({
      method: 'GET',
      url: '/api/events/notebooks',
      headers: { accept: 'application/json' },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json<{ entities: unknown[] }>()
    expect(body.entities.length).toBeGreaterThanOrEqual(1)

    await freshApp.close()
  })

  it('returns global events as HAL', async () => {
    const freshApp = await createFreshApp()
    await createNotebookOn(freshApp, 'HAL global event test')

    const res = await freshApp.inject({
      method: 'GET',
      url: '/api/events/notebooks',
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

let commandCounter = 0
function commandHeaders(): Record<string, string> {
  commandCounter++
  return {
    'x-request-id': `req-${commandCounter}`,
    'x-command-id': `cmd-${commandCounter}`,
  }
}

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
    url: '/api/notebooks',
    payload: { name },
    headers: commandHeaders(),
  })
  const body = res.json<CommandSuccessResponse>()
  return { id: body.id, nextExpectedRevision: body.nextExpectedRevision }
}

async function createFreshApp(): Promise<FastifyInstance> {
  const { app: freshApp } = createApp({ logLevel: 'silent' })
  await freshApp.ready()
  return freshApp
}
