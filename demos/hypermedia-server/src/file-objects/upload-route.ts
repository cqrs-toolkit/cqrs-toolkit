/**
 * Mock S3 file upload endpoint — POST /s3/files.
 *
 * Accepts multipart form data with signed fields from the permit command.
 * Verifies the HMAC signature, stores the file, and creates the FileObject aggregate.
 * Returns 204 No Content (S3-like — no domain data in response).
 *
 * This route is NOT listed in Hydra API docs — it is treated as an external,
 * opaque URL. The presigned permit returns the full absolute URL so the client
 * uses it as-is without needing to resolve it against any origin. CORS is
 * enabled on this route since it is accessed cross-origin in Electron.
 */

import { type TempFileStore, encodeFileResource } from '@cqrs-toolkit/demo-base/common/server'
import {
  FileObjectAggregate,
  type FileObjectRepository,
} from '@cqrs-toolkit/demo-base/file-objects/server'
import type { NoteRepository } from '@cqrs-toolkit/demo-base/notes/server'
import type { MultipartValue } from '@fastify/multipart'
import { EventExistenceRevision, type EventMetadata } from '@meticoeus/ddd-es'
import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import { verifySignature } from './signing.js'

export function uploadRoute(
  fileObjectRepo: FileObjectRepository,
  noteRepo: NoteRepository,
  fileStore: TempFileStore,
): FastifyPluginAsync {
  return async function routes(app: FastifyInstance): Promise<void> {
    // CORS preflight for cross-origin access (Electron renderer uses app:// origin)
    app.options('/s3/files', async (_request, reply) => {
      reply
        .header('Access-Control-Allow-Origin', '*')
        .header('Access-Control-Allow-Methods', 'POST')
        .header('Access-Control-Allow-Headers', 'Content-Type')
        .code(204)
        .send()
    })

    app.post('/s3/files', async (request, reply) => {
      reply.header('Access-Control-Allow-Origin', '*')
      const file = await request.file()
      if (!file) {
        reply.code(400)
        return reply.send({ message: 'Missing file in multipart request' })
      }
      // Extract form fields
      const fields: Record<string, string> = {}
      for (const [key, value] of Object.entries(file.fields)) {
        if (key === 'file') continue
        const field = value as MultipartValue<string> | undefined
        if (field && field.type === 'field' && typeof field.value === 'string') {
          fields[key] = field.value
        }
      }

      // Verify signature
      const { signature, ...dataFields } = fields
      if (!signature || !verifySignature(dataFields, signature)) {
        reply.code(403)
        return reply.send({ message: 'Invalid or missing signature' })
      }

      const { fileId, noteId, filename, metadata: metadataJson } = dataFields
      if (!fileId || !noteId || !filename || !metadataJson) {
        reply.code(400)
        return reply.send({ message: 'Missing required form fields' })
      }

      const note = noteRepo.findById(noteId)
      if (!note) {
        reply.code(400)
        return reply.send({ message: `Note ${noteId} not found` })
      }

      const buffer = await file.toBuffer()

      const declaredSize = parseInt(dataFields.size ?? '', 10)
      if (!declaredSize || buffer.length !== declaredSize) {
        reply.code(400)
        return reply.send({
          message: `File size mismatch: expected ${declaredSize}, got ${buffer.length}`,
        })
      }

      const filePath = fileStore.save(fileId, buffer)
      const resource = encodeFileResource(filePath)

      const metadata = JSON.parse(metadataJson) as EventMetadata

      const aggregate = new FileObjectAggregate()
      aggregate.create(
        {
          noteId,
          name: filename,
          contentType: file.mimetype,
          resource,
          size: buffer.length,
        },
        fileId,
        metadata,
      )

      await fileObjectRepo.save(aggregate, EventExistenceRevision.NoStream)

      reply.code(204)
      return reply.send()
    })
  }
}
