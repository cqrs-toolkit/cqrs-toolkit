import type { CommandSuccessResponse } from '@cqrs-toolkit/demo-base/common/shared'
import type { Note } from '@cqrs-toolkit/demo-base/notes/shared'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../bootstrap.js'

let app: FastifyInstance
let notebookId: string

beforeAll(async () => {
  ;({ app } = createApp({ logLevel: 'silent' }))
  await app.ready()
  notebookId = await createNotebookOn(app)
})

afterAll(async () => {
  await app.close()
})

describe('POST /api/notes (create)', () => {
  it('creates a note and returns the event', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/notes',
      payload: { notebookId, title: 'My Note', body: 'Some content' },
      headers: commandHeaders(),
    })

    expect(res.statusCode).toBe(200)
    const body = res.json<CommandSuccessResponse>()
    expect(body.id).toBeDefined()
    expect(body.nextExpectedRevision).toBe('0')
    expect(body.events).toHaveLength(1)
    expect(body.events[0]?.type).toBe('NoteCreated')
    expect(body.events[0]?.data).toMatchObject({
      notebookId,
      title: 'My Note',
      body: 'Some content',
    })
  })

  it('rejects empty title', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/notes',
      payload: { notebookId, title: '', body: 'content' },
      headers: commandHeaders(),
    })

    expect(res.statusCode).toBe(400)
  })

  it('rejects missing body field', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/notes',
      payload: { notebookId, title: 'test' },
      headers: commandHeaders(),
    })

    expect(res.statusCode).toBe(400)
  })

  it('allows empty body', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/notes',
      payload: { notebookId, title: 'Empty body note', body: '' },
      headers: commandHeaders(),
    })

    expect(res.statusCode).toBe(200)
  })
})

describe('POST /api/notes/:id/command', () => {
  describe('updateTitle', () => {
    it('updates title on an existing note', async () => {
      const { id: noteId, nextExpectedRevision } = await createNote('Original Title', 'body')

      const res = await app.inject({
        method: 'POST',
        url: `/api/notes/${noteId}/command`,
        payload: {
          type: 'updateTitle',
          data: { title: 'New Title' },
          revision: nextExpectedRevision,
        },
        headers: commandHeaders(),
      })

      expect(res.statusCode).toBe(200)
      const body = res.json<CommandSuccessResponse>()
      expect(body.events[0]?.type).toBe('NoteTitleUpdated')
      expect(body.events[0]?.data).toMatchObject({ title: 'New Title' })
    })

    it('returns 404 for nonexistent note', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/notes/nonexistent/command',
        payload: {
          type: 'updateTitle',
          data: { title: 'x' },
          revision: '0',
        },
        headers: commandHeaders(),
      })

      expect(res.statusCode).toBe(404)
      expect(res.json()).toMatchObject({ message: 'Note not found' })
    })
  })

  describe('updateBody', () => {
    it('updates body on an existing note', async () => {
      const { id: noteId, nextExpectedRevision } = await createNote('Body test', 'old body')

      const res = await app.inject({
        method: 'POST',
        url: `/api/notes/${noteId}/command`,
        payload: {
          type: 'updateBody',
          data: { body: 'new body' },
          revision: nextExpectedRevision,
        },
        headers: commandHeaders(),
      })

      expect(res.statusCode).toBe(200)
      const body = res.json<CommandSuccessResponse>()
      expect(body.events[0]?.type).toBe('NoteBodyUpdated')
      expect(body.events[0]?.data).toMatchObject({ body: 'new body' })
    })

    it('returns 404 for nonexistent note', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/notes/nonexistent/command',
        payload: {
          type: 'updateBody',
          data: { body: 'x' },
          revision: '0',
        },
        headers: commandHeaders(),
      })

      expect(res.statusCode).toBe(404)
    })
  })

  describe('delete', () => {
    it('deletes an existing note', async () => {
      const { id: noteId, nextExpectedRevision } = await createNote('To be deleted', 'bye')

      const res = await app.inject({
        method: 'POST',
        url: `/api/notes/${noteId}/command`,
        payload: {
          type: 'delete',
          data: {},
          revision: nextExpectedRevision,
        },
        headers: commandHeaders(),
      })

      expect(res.statusCode).toBe(200)
      const body = res.json<CommandSuccessResponse>()
      expect(body.events[0]?.type).toBe('NoteDeleted')

      const getRes = await app.inject({
        method: 'GET',
        url: `/api/notes/${noteId}`,
        headers: { accept: 'application/json' },
      })
      expect(getRes.statusCode).toBe(404)
    })

    it('returns 404 for nonexistent note', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/notes/nonexistent/command',
        payload: { type: 'delete', data: {}, revision: '0' },
        headers: commandHeaders(),
      })

      expect(res.statusCode).toBe(404)
    })
  })

  it('returns 400 for unknown command type', async () => {
    const { id: noteId } = await createNote('Unknown cmd test', 'body')

    const res = await app.inject({
      method: 'POST',
      url: `/api/notes/${noteId}/command`,
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
      url: '/api/notes',
      payload: { notebookId, title: 'Metadata test', body: 'meta body' },
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
    const { id: noteId, nextExpectedRevision } = await createNote('Meta cmd test', 'body')

    const res = await app.inject({
      method: 'POST',
      url: `/api/notes/${noteId}/command`,
      payload: {
        type: 'updateTitle',
        data: { title: 'Updated meta' },
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
      url: '/api/notes',
      payload: { notebookId, title: 'No headers', body: 'no headers' },
    })

    expect(res.statusCode).toBe(400)
  })
})

describe('GET /api/notes', () => {
  describe('application/json', () => {
    it('lists notes sorted by createdAt', async () => {
      const fresh = await createFreshApp()
      const { id: id1 } = await createNoteOn(fresh.app, fresh.notebookId, 'First', 'a')
      const { id: id2 } = await createNoteOn(fresh.app, fresh.notebookId, 'Second', 'b')

      const res = await fresh.app.inject({
        method: 'GET',
        url: '/api/notes',
        headers: { accept: 'application/json' },
      })

      expect(res.statusCode).toBe(200)
      expect(res.headers['content-type']).toContain('application/json')
      const body = res.json<{ entities: Note[] }>()
      expect(body.entities).toHaveLength(2)
      expect(body.entities[0]?.id).toBe(id1)
      expect(body.entities[1]?.id).toBe(id2)

      await fresh.app.close()
    })
  })

  describe('application/hal+json', () => {
    it('lists notes as HAL collection', async () => {
      const fresh = await createFreshApp()
      await createNoteOn(fresh.app, fresh.notebookId, 'First', 'a')
      await createNoteOn(fresh.app, fresh.notebookId, 'Second', 'b')

      const res = await fresh.app.inject({
        method: 'GET',
        url: '/api/notes',
        headers: { accept: 'application/hal+json' },
      })

      expect(res.statusCode).toBe(200)
      expect(res.headers['content-type']).toContain('application/hal+json')
      const body = res.json()
      expect(body._links).toBeDefined()
      expect(body._embedded).toBeDefined()
      const items = body._embedded.item as Record<string, unknown>[]
      expect(items).toHaveLength(2)

      await fresh.app.close()
    })
  })
})

describe('GET /api/notes/:id', () => {
  it('returns a note as JSON', async () => {
    const { id: noteId } = await createNote('Fetch me', 'content here')

    const res = await app.inject({
      method: 'GET',
      url: `/api/notes/${noteId}`,
      headers: { accept: 'application/json' },
    })

    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('application/json')
    const body = res.json<Note>()
    expect(body.id).toBe(noteId)
    expect(body.title).toBe('Fetch me')
    expect(body.body).toBe('content here')
    expect(body.latestRevision).toBe('0')
  })

  it('returns a note as HAL', async () => {
    const { id: noteId } = await createNote('HAL me', 'hal content')

    const res = await app.inject({
      method: 'GET',
      url: `/api/notes/${noteId}`,
      headers: { accept: 'application/hal+json' },
    })

    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('application/hal+json')
    const body = res.json()
    expect(body._links).toBeDefined()
    expect(body.id).toBe(noteId)
    expect(body.title).toBe('HAL me')
  })

  it('returns 404 for nonexistent note', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/notes/nonexistent',
      headers: { accept: 'application/json' },
    })

    expect(res.statusCode).toBe(404)
  })
})

describe('GET /api/notes/:id/events', () => {
  it('returns item events as JSON', async () => {
    const { id: noteId, nextExpectedRevision } = await createNote('Event stream test', 'body')

    await app.inject({
      method: 'POST',
      url: `/api/notes/${noteId}/command`,
      payload: {
        type: 'updateTitle',
        data: { title: 'Updated' },
        revision: nextExpectedRevision,
      },
      headers: commandHeaders(),
    })

    const res = await app.inject({
      method: 'GET',
      url: `/api/notes/${noteId}/events`,
      headers: { accept: 'application/json' },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json<{ entities: unknown[] }>()
    expect(body.entities).toHaveLength(2)
  })

  it('returns item events as HAL', async () => {
    const { id: noteId } = await createNote('HAL events test', 'body')

    const res = await app.inject({
      method: 'GET',
      url: `/api/notes/${noteId}/events`,
      headers: { accept: 'application/hal+json' },
    })

    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('application/hal+json')
    const body = res.json()
    expect(body._links).toBeDefined()
    expect(body._embedded).toBeDefined()
  })
})

describe('GET /api/events/notes', () => {
  it('returns global events as JSON', async () => {
    const fresh = await createFreshApp()
    await createNoteOn(fresh.app, fresh.notebookId, 'Global event test', 'body')

    const res = await fresh.app.inject({
      method: 'GET',
      url: '/api/events/notes',
      headers: { accept: 'application/json' },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json<{ entities: unknown[] }>()
    expect(body.entities.length).toBeGreaterThanOrEqual(1)

    await fresh.app.close()
  })

  it('returns global events as HAL', async () => {
    const fresh = await createFreshApp()
    await createNoteOn(fresh.app, fresh.notebookId, 'HAL global event test', 'body')

    const res = await fresh.app.inject({
      method: 'GET',
      url: '/api/events/notes',
      headers: { accept: 'application/hal+json' },
    })

    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('application/hal+json')
    const body = res.json()
    expect(body._links).toBeDefined()
    expect(body._embedded).toBeDefined()

    await fresh.app.close()
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

async function createNote(title: string, body: string): Promise<CreateResult> {
  return createNoteOn(app, notebookId, title, body)
}

async function createNoteOn(
  instance: FastifyInstance,
  nbId: string,
  title: string,
  body: string,
): Promise<CreateResult> {
  const res = await instance.inject({
    method: 'POST',
    url: '/api/notes',
    payload: { notebookId: nbId, title, body },
    headers: commandHeaders(),
  })
  const resBody = res.json<CommandSuccessResponse>()
  return { id: resBody.id, nextExpectedRevision: resBody.nextExpectedRevision }
}

async function createNotebookOn(instance: FastifyInstance): Promise<string> {
  const res = await instance.inject({
    method: 'POST',
    url: '/api/notebooks',
    payload: { name: 'Test Notebook' },
    headers: commandHeaders(),
  })
  const resBody = res.json<CommandSuccessResponse>()
  return resBody.id
}

async function createFreshApp(): Promise<{ app: FastifyInstance; notebookId: string }> {
  const { app: freshApp } = createApp({ logLevel: 'silent' })
  await freshApp.ready()
  const nbId = await createNotebookOn(freshApp)
  return { app: freshApp, notebookId: nbId }
}
