import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Note } from '../../shared/notes/types.js'
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

describe('POST /api/notes/commands', () => {
  describe('CreateNote', () => {
    it('creates a note and returns the event', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/notes/commands',
        payload: { type: 'CreateNote', payload: { title: 'My Note', body: 'Some content' } },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json<CommandSuccessResponse>()
      expect(body.id).toBeDefined()
      expect(body.nextExpectedRevision).toBe('0')
      expect(body.events).toHaveLength(1)
      expect(body.events[0]?.type).toBe('NoteCreated')
      expect(body.events[0]?.data).toMatchObject({
        title: 'My Note',
        body: 'Some content',
      })
    })

    it('rejects empty title', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/notes/commands',
        payload: { type: 'CreateNote', payload: { title: '', body: 'content' } },
      })

      expect(res.statusCode).toBe(400)
      expect(res.json()).toMatchObject({ message: 'Invalid payload' })
    })

    it('rejects missing body field', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/notes/commands',
        payload: { type: 'CreateNote', payload: { title: 'test' } },
      })

      expect(res.statusCode).toBe(400)
    })

    it('allows empty body', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/notes/commands',
        payload: { type: 'CreateNote', payload: { title: 'Empty body note', body: '' } },
      })

      expect(res.statusCode).toBe(200)
    })
  })

  describe('UpdateNoteTitle', () => {
    it('updates title on an existing note', async () => {
      const { id: noteId, nextExpectedRevision } = await createNote('Original Title', 'body')

      const res = await app.inject({
        method: 'POST',
        url: '/api/notes/commands',
        payload: {
          type: 'UpdateNoteTitle',
          payload: { id: noteId, title: 'New Title', revision: nextExpectedRevision },
        },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json<CommandSuccessResponse>()
      expect(body.events[0]?.type).toBe('NoteTitleUpdated')
      expect(body.events[0]?.data).toMatchObject({ title: 'New Title' })
    })

    it('returns 404 for nonexistent note', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/notes/commands',
        payload: {
          type: 'UpdateNoteTitle',
          payload: { id: 'nonexistent', title: 'x', revision: '0' },
        },
      })

      expect(res.statusCode).toBe(404)
      expect(res.json()).toMatchObject({ message: 'Note not found' })
    })
  })

  describe('UpdateNoteBody', () => {
    it('updates body on an existing note', async () => {
      const { id: noteId, nextExpectedRevision } = await createNote('Body test', 'old body')

      const res = await app.inject({
        method: 'POST',
        url: '/api/notes/commands',
        payload: {
          type: 'UpdateNoteBody',
          payload: { id: noteId, body: 'new body', revision: nextExpectedRevision },
        },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json<CommandSuccessResponse>()
      expect(body.events[0]?.type).toBe('NoteBodyUpdated')
      expect(body.events[0]?.data).toMatchObject({ body: 'new body' })
    })

    it('returns 404 for nonexistent note', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/notes/commands',
        payload: {
          type: 'UpdateNoteBody',
          payload: { id: 'nonexistent', body: 'x', revision: '0' },
        },
      })

      expect(res.statusCode).toBe(404)
    })
  })

  describe('DeleteNote', () => {
    it('deletes an existing note', async () => {
      const { id: noteId, nextExpectedRevision } = await createNote('To be deleted', 'bye')

      const res = await app.inject({
        method: 'POST',
        url: '/api/notes/commands',
        payload: {
          type: 'DeleteNote',
          payload: { id: noteId, revision: nextExpectedRevision },
        },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json<CommandSuccessResponse>()
      expect(body.events[0]?.type).toBe('NoteDeleted')

      const getRes = await app.inject({ method: 'GET', url: `/api/notes/${noteId}` })
      expect(getRes.statusCode).toBe(404)
    })

    it('returns 404 for nonexistent note', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/notes/commands',
        payload: { type: 'DeleteNote', payload: { id: 'nonexistent', revision: '0' } },
      })

      expect(res.statusCode).toBe(404)
    })
  })

  it('returns 400 for unknown command type', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/notes/commands',
      payload: { type: 'FlyToMoon', payload: {} },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json()).toMatchObject({ message: 'Unknown command type' })
  })
})

describe('GET /api/notes', () => {
  it('lists notes sorted by createdAt', async () => {
    const freshApp = await createFreshApp()
    const { id: id1 } = await createNoteOn(freshApp, 'First', 'a')
    const { id: id2 } = await createNoteOn(freshApp, 'Second', 'b')

    const res = await freshApp.inject({ method: 'GET', url: '/api/notes' })

    expect(res.statusCode).toBe(200)
    const body = res.json<{ items: Note[]; nextCursor: string | null }>()
    expect(body.items).toHaveLength(2)
    expect(body.items[0]?.id).toBe(id1)
    expect(body.items[1]?.id).toBe(id2)
    expect(body.nextCursor).toBeNull()

    await freshApp.close()
  })
})

describe('GET /api/notes/:id', () => {
  it('returns a note by id with latestRevision', async () => {
    const { id: noteId } = await createNote('Fetch me', 'content here')

    const res = await app.inject({ method: 'GET', url: `/api/notes/${noteId}` })

    expect(res.statusCode).toBe(200)
    const body = res.json<Note>()
    expect(body.id).toBe(noteId)
    expect(body.title).toBe('Fetch me')
    expect(body.body).toBe('content here')
    expect(body.latestRevision).toBe('0')
  })

  it('returns 404 for nonexistent note', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/notes/nonexistent' })

    expect(res.statusCode).toBe(404)
  })
})

describe('GET /api/notes/:id/events', () => {
  it('returns the event stream for a note', async () => {
    const { id: noteId, nextExpectedRevision } = await createNote('Event stream test', 'body')

    await app.inject({
      method: 'POST',
      url: '/api/notes/commands',
      payload: {
        type: 'UpdateNoteTitle',
        payload: { id: noteId, title: 'Updated', revision: nextExpectedRevision },
      },
    })

    const res = await app.inject({ method: 'GET', url: `/api/notes/${noteId}/events` })

    expect(res.statusCode).toBe(200)
    const body = res.json<{ events: unknown[] }>()
    expect(body.events).toHaveLength(2)
  })
})

describe('GET /api/events/notes', () => {
  it('returns global note events', async () => {
    const freshApp = await createFreshApp()
    await createNoteOn(freshApp, 'Global event test', 'body')

    const res = await freshApp.inject({ method: 'GET', url: '/api/events/notes' })

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

async function createNote(title: string, body: string): Promise<CreateResult> {
  return createNoteOn(app, title, body)
}

async function createNoteOn(
  instance: FastifyInstance,
  title: string,
  body: string,
): Promise<CreateResult> {
  const res = await instance.inject({
    method: 'POST',
    url: '/api/notes/commands',
    payload: { type: 'CreateNote', payload: { title, body } },
  })
  const resBody = res.json<CommandSuccessResponse>()
  return { id: resBody.id, nextExpectedRevision: resBody.nextExpectedRevision }
}

async function createFreshApp(): Promise<FastifyInstance> {
  const { app: freshApp } = createApp({ logLevel: 'silent' })
  await freshApp.ready()
  return freshApp
}
