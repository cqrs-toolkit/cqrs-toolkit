import type { CommandSuccessResponse } from '@cqrs-toolkit/demo-base/common/shared'
import type { FileObject } from '@cqrs-toolkit/demo-base/file-objects/server'
import type { FastifyInstance } from 'fastify'
import FormData from 'form-data'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../bootstrap.js'

let app: FastifyInstance
let notebookId: string
let noteId: string

beforeAll(async () => {
  ;({ app } = createApp({ logLevel: 'silent' }))
  await app.ready()
  notebookId = await createNotebookOn(app)
  ;({ id: noteId } = await createNoteOn(app, notebookId, 'Test Note', 'body'))
})

afterAll(async () => {
  await app.close()
})

describe('POST /api/file-objects/commands (CreateFileObject via multipart)', () => {
  it('uploads a file and returns the event', async () => {
    const res = await uploadFileObject(app, noteId, 'test.txt', 'hello world', 'text/plain')

    expect(res.statusCode).toBe(200)
    const body = res.json<CommandSuccessResponse>()
    expect(body.id).toBeDefined()
    expect(body.nextExpectedRevision).toBe('0')
    expect(body.events).toHaveLength(1)
    expect(body.events[0]?.type).toBe('FileObjectCreated')
    expect(body.events[0]?.data).toMatchObject({
      noteId,
      name: 'test.txt',
      contentType: 'text/plain',
      size: 11,
    })
  })

  it('returns 404 when note does not exist', async () => {
    const res = await uploadFileObject(app, 'nonexistent', 'test.txt', 'data', 'text/plain')

    expect(res.statusCode).toBe(404)
    expect(res.json()).toMatchObject({ message: 'Note not found' })
  })

  it('returns 400 when noteId is missing', async () => {
    const form = new FormData()
    form.append('file', Buffer.from('data'), { filename: 'test.txt', contentType: 'text/plain' })

    const res = await app.inject({
      method: 'POST',
      url: '/api/file-objects/commands',
      payload: form,
      headers: form.getHeaders(),
    })

    expect(res.statusCode).toBe(400)
    expect(res.json()).toMatchObject({ message: 'noteId is required' })
  })

  it('returns 400 when file is missing', async () => {
    const form = new FormData()
    form.append('noteId', noteId)

    const res = await app.inject({
      method: 'POST',
      url: '/api/file-objects/commands',
      payload: form,
      headers: form.getHeaders(),
    })

    expect(res.statusCode).toBe(400)
    expect(res.json()).toMatchObject({ message: 'File is required' })
  })
})

describe('POST /api/file-objects/commands (DeleteFileObject)', () => {
  it('deletes an existing file object', async () => {
    const { id, nextExpectedRevision } = await createFileObject(app, noteId)

    const res = await app.inject({
      method: 'POST',
      url: '/api/file-objects/commands',
      payload: {
        type: 'DeleteFileObject',
        data: { id },
        revision: nextExpectedRevision,
      },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json<CommandSuccessResponse>()
    expect(body.events[0]?.type).toBe('FileObjectDeleted')

    const getRes = await app.inject({ method: 'GET', url: `/api/file-objects/${id}` })
    expect(getRes.statusCode).toBe(404)
  })

  it('returns 404 for nonexistent file object', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/file-objects/commands',
      payload: { type: 'DeleteFileObject', data: { id: 'nonexistent' }, revision: '0' },
    })

    expect(res.statusCode).toBe(404)
  })

  it('returns 400 for unknown command type', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/file-objects/commands',
      payload: { type: 'FlyToMoon', data: {} },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json()).toMatchObject({ message: 'Unknown command type' })
  })
})

describe('GET /api/file-objects', () => {
  it('lists file objects by noteId', async () => {
    const fresh = await createFreshApp()
    await createFileObject(fresh.app, fresh.noteId, 'file1.txt')
    await createFileObject(fresh.app, fresh.noteId, 'file2.txt')

    const res = await fresh.app.inject({
      method: 'GET',
      url: `/api/file-objects?noteId=${fresh.noteId}`,
    })

    expect(res.statusCode).toBe(200)
    const body = res.json<{ items: FileObject[]; nextCursor: string | null }>()
    expect(body.items).toHaveLength(2)
    expect(body.nextCursor).toBeNull()

    await fresh.app.close()
  })
})

describe('GET /api/file-objects/:id', () => {
  it('returns file object metadata with notebookId', async () => {
    const { id } = await createFileObject(app, noteId)

    const res = await app.inject({ method: 'GET', url: `/api/file-objects/${id}` })

    expect(res.statusCode).toBe(200)
    const body = res.json<FileObject>()
    expect(body.id).toBe(id)
    expect(body.noteId).toBe(noteId)
    expect(body.notebookId).toBe(notebookId)
    expect(body.name).toBe('test.txt')
    expect(body.latestRevision).toBe('0')
  })

  it('returns 404 for nonexistent file object', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/file-objects/nonexistent' })

    expect(res.statusCode).toBe(404)
  })
})

describe('GET /api/file-objects/:id/download', () => {
  it('returns file binary with correct headers', async () => {
    const { id } = await createFileObject(app, noteId, 'hello.txt', 'file contents here')

    const res = await app.inject({ method: 'GET', url: `/api/file-objects/${id}/download` })

    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toBe('text/plain')
    expect(res.headers['content-disposition']).toBe('attachment; filename="hello.txt"')
    expect(res.body).toBe('file contents here')
  })

  it('returns 404 for nonexistent file object', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/file-objects/nonexistent/download' })

    expect(res.statusCode).toBe(404)
  })
})

describe('GET /api/file-objects/:id/events', () => {
  it('returns the event stream for a file object', async () => {
    const { id } = await createFileObject(app, noteId)

    const res = await app.inject({ method: 'GET', url: `/api/file-objects/${id}/events` })

    expect(res.statusCode).toBe(200)
    const body = res.json<{ events: unknown[] }>()
    expect(body.events).toHaveLength(1)
  })
})

describe('GET /api/events/file-objects', () => {
  it('returns global file object events', async () => {
    const fresh = await createFreshApp()
    await createFileObject(fresh.app, fresh.noteId)

    const res = await fresh.app.inject({ method: 'GET', url: '/api/events/file-objects' })

    expect(res.statusCode).toBe(200)
    const body = res.json<{ events: unknown[]; nextCursor: string | null }>()
    expect(body.events.length).toBeGreaterThanOrEqual(1)

    await fresh.app.close()
  })
})

// --- Helpers ---

interface CreateResult {
  id: string
  nextExpectedRevision: string
}

async function uploadFileObject(
  instance: FastifyInstance,
  uploadNoteId: string,
  filename: string,
  content: string,
  contentType: string,
) {
  const form = new FormData()
  form.append('noteId', uploadNoteId)
  form.append('file', Buffer.from(content), { filename, contentType })

  return instance.inject({
    method: 'POST',
    url: '/api/file-objects/commands',
    payload: form,
    headers: form.getHeaders(),
  })
}

async function createFileObject(
  instance: FastifyInstance,
  parentNoteId: string,
  filename = 'test.txt',
  content = 'test content',
): Promise<CreateResult> {
  const res = await uploadFileObject(instance, parentNoteId, filename, content, 'text/plain')
  expect(res.statusCode).toBe(200)
  const body = res.json<CommandSuccessResponse>()
  return { id: body.id, nextExpectedRevision: body.nextExpectedRevision }
}

async function createNotebookOn(instance: FastifyInstance): Promise<string> {
  const res = await instance.inject({
    method: 'POST',
    url: '/api/notebooks/commands',
    payload: { type: 'CreateNotebook', data: { name: 'Test Notebook' } },
  })
  const body = res.json<CommandSuccessResponse>()
  return body.id
}

async function createNoteOn(
  instance: FastifyInstance,
  nbId: string,
  title: string,
  body: string,
): Promise<CreateResult> {
  const res = await instance.inject({
    method: 'POST',
    url: '/api/notes/commands',
    payload: { type: 'CreateNote', data: { notebookId: nbId, title, body } },
  })
  const resBody = res.json<CommandSuccessResponse>()
  return { id: resBody.id, nextExpectedRevision: resBody.nextExpectedRevision }
}

async function createFreshApp(): Promise<{
  app: FastifyInstance
  notebookId: string
  noteId: string
}> {
  const { app: freshApp } = createApp({ logLevel: 'silent' })
  await freshApp.ready()
  const nbId = await createNotebookOn(freshApp)
  const { id: nId } = await createNoteOn(freshApp, nbId, 'Test Note', 'body')
  return { app: freshApp, notebookId: nbId, noteId: nId }
}
