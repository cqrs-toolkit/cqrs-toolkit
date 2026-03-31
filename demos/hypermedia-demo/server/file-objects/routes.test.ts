import type { CommandSuccessResponse } from '@cqrs-toolkit/demo-base/common/shared'
import type { FileObject } from '@cqrs-toolkit/demo-base/file-objects/shared'
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

// ---------------------------------------------------------------------------
// Permit + Upload flow
// ---------------------------------------------------------------------------

describe('POST /api/file-objects (permit)', () => {
  it('returns an upload form with url, fields, and signature', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/file-objects',
      payload: { noteId, filename: 'test.txt', size: 100 },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json<{ id: string; data: { uploadForm: UploadForm } }>()
    expect(body.id).toBeDefined()
    expect(body.data.uploadForm.url).toContain('/api/files')
    expect(body.data.uploadForm.fields.fileId).toBe(body.id)
    expect(body.data.uploadForm.fields.noteId).toBe(noteId)
    expect(body.data.uploadForm.fields.filename).toBe('test.txt')
    expect(body.data.uploadForm.fields.signature).toBeDefined()
  })

  it('returns 404 when note does not exist', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/file-objects',
      payload: { noteId: 'nonexistent', filename: 'test.txt', size: 100 },
    })

    expect(res.statusCode).toBe(404)
  })

  it('rejects permit with missing filename', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/file-objects',
      payload: { noteId, size: 100 },
    })

    expect(res.statusCode).toBe(400)
  })

  it('rejects permit with invalid size', async () => {
    const zero = await app.inject({
      method: 'POST',
      url: '/api/file-objects',
      payload: { noteId, filename: 'test.txt', size: 0 },
    })
    expect(zero.statusCode).toBe(400)

    const negative = await app.inject({
      method: 'POST',
      url: '/api/file-objects',
      payload: { noteId, filename: 'test.txt', size: -1 },
    })
    expect(negative.statusCode).toBe(400)
  })
})

describe('POST /api/files (upload)', () => {
  it('accepts upload with valid signature and creates FileObject', async () => {
    const content = 'file contents here'
    const permit = await getPermit(app, noteId, 'upload-test.txt', Buffer.byteLength(content))
    const res = await uploadFile(app, permit.data.uploadForm, content)

    expect(res.statusCode).toBe(204)

    // FileObject should now be available via GET
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/file-objects/${permit.id}`,
    })
    expect(getRes.statusCode).toBe(200)
    const fileObj = getRes.json<FileObject>()
    expect(fileObj.noteId).toBe(noteId)
    expect(fileObj.notebookId).toBe(notebookId)
    expect(fileObj.name).toBe('upload-test.txt')
  })

  it('rejects upload with tampered fields (signature mismatch)', async () => {
    const permit = await getPermit(app, noteId, 'tampered.txt', 50)
    const fields = { ...permit.data.uploadForm.fields, filename: 'hacked.txt' }
    const form = new FormData()
    for (const [key, value] of Object.entries(fields)) {
      form.append(key, value)
    }
    form.append('file', Buffer.from('data'), {
      filename: 'hacked.txt',
      contentType: 'text/plain',
    })

    const res = await app.inject({
      method: 'POST',
      url: '/api/files',
      payload: form,
      headers: form.getHeaders(),
    })

    expect(res.statusCode).toBe(403)
  })

  it('rejects upload when file size does not match permit', async () => {
    const permit = await getPermit(app, noteId, 'size-mismatch.txt', 5)
    const res = await uploadFile(app, permit.data.uploadForm, 'this is much longer than 5 bytes')

    expect(res.statusCode).toBe(400)
  })

  it('rejects upload with missing form fields', async () => {
    const form = new FormData()
    form.append('file', Buffer.from('data'), { filename: 'test.txt', contentType: 'text/plain' })

    const res = await app.inject({
      method: 'POST',
      url: '/api/files',
      payload: form,
      headers: form.getHeaders(),
    })

    expect([400, 403]).toContain(res.statusCode)
  })

  it('rejects upload with missing file', async () => {
    const permit = await getPermit(app, noteId, 'nofile.txt', 10)
    const form = new FormData()
    for (const [key, value] of Object.entries(permit.data.uploadForm.fields)) {
      form.append(key, value)
    }

    const res = await app.inject({
      method: 'POST',
      url: '/api/files',
      payload: form,
      headers: form.getHeaders(),
    })

    expect(res.statusCode).toBe(400)
  })
})

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

describe('POST /api/file-objects/:id/command (delete)', () => {
  it('deletes an existing file object', async () => {
    const { id, revision } = await createFileObject(app, noteId)

    const res = await app.inject({
      method: 'POST',
      url: `/api/file-objects/${id}/command`,
      payload: { type: 'delete', data: {}, revision },
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
      url: '/api/file-objects/nonexistent/command',
      payload: { type: 'delete', data: {}, revision: '0' },
    })

    expect(res.statusCode).toBe(404)
  })

  it('rejects delete with wrong revision (concurrency conflict)', async () => {
    const { id } = await createFileObject(app, noteId)

    const res = await app.inject({
      method: 'POST',
      url: `/api/file-objects/${id}/command`,
      payload: { type: 'delete', data: {}, revision: '999' },
    })

    expect(res.statusCode).not.toBe(200)
  })
})

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

describe('GET /api/file-objects', () => {
  it('lists file objects by noteId', async () => {
    const fresh = await createFreshApp()
    await createFileObject(fresh.app, fresh.noteId, 'a.txt')
    await createFileObject(fresh.app, fresh.noteId, 'b.txt')

    const res = await fresh.app.inject({
      method: 'GET',
      url: `/api/file-objects?noteId=${fresh.noteId}`,
      headers: { accept: 'application/json' },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json<{ entities: FileObject[] }>()
    expect(body.entities).toHaveLength(2)

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

    const res = await app.inject({
      method: 'GET',
      url: `/api/file-objects/${id}/events`,
      headers: { accept: 'application/json' },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json<{ entities: unknown[] }>()
    expect(body.entities).toHaveLength(1)
  })
})

describe('GET /api/file-objects/events', () => {
  it('returns global file object events', async () => {
    const fresh = await createFreshApp()
    await createFileObject(fresh.app, fresh.noteId)

    const res = await fresh.app.inject({
      method: 'GET',
      url: '/api/events/file-objects',
      headers: { accept: 'application/json' },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json<{ entities: unknown[] }>()
    expect(body.entities.length).toBeGreaterThanOrEqual(1)

    await fresh.app.close()
  })
})

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UploadForm {
  url: string
  fields: Record<string, string>
}

interface PermitResponse {
  id: string
  data: { uploadForm: UploadForm }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getPermit(
  instance: FastifyInstance,
  permitNoteId: string,
  filename: string,
  size: number,
): Promise<PermitResponse> {
  const res = await instance.inject({
    method: 'POST',
    url: '/api/file-objects',
    payload: { noteId: permitNoteId, filename, size },
  })
  expect(res.statusCode).toBe(200)
  return res.json<PermitResponse>()
}

async function uploadFile(instance: FastifyInstance, uploadForm: UploadForm, content: string) {
  const form = new FormData()
  for (const [key, value] of Object.entries(uploadForm.fields)) {
    form.append(key, value)
  }
  form.append('file', Buffer.from(content), {
    filename: uploadForm.fields['filename'] ?? 'test.txt',
    contentType: 'text/plain',
  })

  return instance.inject({
    method: 'POST',
    url: '/api/files',
    payload: form,
    headers: form.getHeaders(),
  })
}

async function createFileObject(
  instance: FastifyInstance,
  parentNoteId: string,
  filename = 'test.txt',
  content = 'test content',
): Promise<{ id: string; revision: string }> {
  const permit = await getPermit(instance, parentNoteId, filename, content.length)
  const uploadRes = await uploadFile(instance, permit.data.uploadForm, content)
  expect(uploadRes.statusCode).toBe(204)

  // Verify the FileObject was created
  const getRes = await instance.inject({
    method: 'GET',
    url: `/api/file-objects/${permit.id}`,
  })
  expect(getRes.statusCode).toBe(200)
  const fileObj = getRes.json<FileObject>()
  return { id: permit.id, revision: fileObj.latestRevision ?? '0' }
}

async function createNotebookOn(instance: FastifyInstance): Promise<string> {
  const res = await instance.inject({
    method: 'POST',
    url: '/api/notebooks',
    payload: { name: 'Test Notebook' },
  })
  const body = res.json<CommandSuccessResponse>()
  return body.id
}

async function createNoteOn(
  instance: FastifyInstance,
  nbId: string,
  title: string,
  body: string,
): Promise<{ id: string }> {
  const res = await instance.inject({
    method: 'POST',
    url: '/api/notes',
    payload: { notebookId: nbId, title, body },
  })
  const resBody = res.json<CommandSuccessResponse>()
  return { id: resBody.id }
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
