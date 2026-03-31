/**
 * Mock S3 file upload endpoint — POST /api/files.
 *
 * Accepts multipart form data with signed fields from the permit command.
 * Verifies the HMAC signature, stores the file, and creates the FileObject aggregate.
 * Returns 204 No Content (S3-like — no domain data in response).
 *
 * This route is NOT listed in Hydra API docs — it is treated as an external URL.
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
import { v4 as uuidv4 } from 'uuid'
import { verifySignature } from './signing.js'

export function uploadRoute(
  fileObjectRepo: FileObjectRepository,
  noteRepo: NoteRepository,
  fileStore: TempFileStore,
): FastifyPluginAsync {
  return async function routes(app: FastifyInstance): Promise<void> {
    app.post('/api/files', async (request, reply) => {
      const file = await request.file()
      if (!file) {
        reply.code(400)
        return reply.send()
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
        return reply.send()
      }

      const { fileId, noteId, filename } = dataFields
      if (!fileId || !noteId || !filename) {
        reply.code(400)
        return reply.send()
      }

      const note = noteRepo.findById(noteId)
      if (!note) {
        reply.code(400)
        return reply.send()
      }

      const buffer = await file.toBuffer()

      const declaredSize = parseInt(dataFields.size ?? '', 10)
      if (!declaredSize || buffer.length !== declaredSize) {
        reply.code(400)
        return reply.send()
      }

      const filePath = fileStore.save(fileId, buffer)
      const resource = encodeFileResource(filePath)

      const metadata: EventMetadata = {
        correlationId: (request.headers['x-request-id'] as string) ?? uuidv4(),
      }

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
