/**
 * FileObject API routes — multipart upload for creates, JSON for deletes.
 */

import {
  type DemoEventStore,
  type TempFileStore,
  encodeFileResource,
  parseFileResource,
} from '@cqrs-toolkit/demo-base/common/server'
import type { CommandResponse, CommandSuccessResponse } from '@cqrs-toolkit/demo-base/common/shared'
import {
  type FileObject,
  FileObjectAggregate,
  type FileObjectRepository,
  type FileObjectServerEvent,
  type ListFileObjectsResponse,
} from '@cqrs-toolkit/demo-base/file-objects/server'
import {} from '@cqrs-toolkit/demo-base/file-objects/shared'
import type { NoteRepository } from '@cqrs-toolkit/demo-base/notes/server'
import type { MultipartValue } from '@fastify/multipart'
import {
  EventExistenceRevision,
  type EventMetadata,
  type IEvent,
  type ISerializedEvent,
  type Persisted,
} from '@meticoeus/ddd-es'
import { Ajv } from 'ajv'
import type { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify'
import { v4 as uuidv4 } from 'uuid'
import { type FileObjectCommand, deleteFileObjectPayloadSchema } from './commands.js'

const ajv = new Ajv()

const validateDeleteFileObject = ajv.compile(deleteFileObjectPayloadSchema)

function toSerializedEvent(event: Persisted<IEvent>): ISerializedEvent {
  return {
    streamId: event.streamId,
    id: event.id,
    revision: String(event.revision),
    position: String(event.position),
    type: event.type,
    data: event.data,
    metadata: event.metadata,
    created: event.created,
  }
}

function toCommandSuccess(
  aggregateId: string,
  nextExpectedRevision: bigint,
  events: Persisted<FileObjectServerEvent>[],
): CommandSuccessResponse {
  return {
    id: aggregateId,
    nextExpectedRevision: String(nextExpectedRevision),
    events: events.map((e) => toSerializedEvent(e as Persisted<IEvent>)),
  }
}

export function fileObjectRoutes(
  eventStore: DemoEventStore,
  fileObjectRepo: FileObjectRepository,
  noteRepo: NoteRepository,
  fileStore: TempFileStore,
): FastifyPluginAsync {
  return async function routes(app: FastifyInstance): Promise<void> {
    app.get<{
      Querystring: { cursor?: string; limit?: string; noteId?: string; notebookId?: string }
      Reply: ListFileObjectsResponse
    }>('/file-objects', async (request) => {
      const limit = parseInt(request.query.limit ?? '50', 10)
      if (request.query.noteId) {
        return fileObjectRepo.listByNote(request.query.noteId, request.query.cursor, limit)
      }
      if (request.query.notebookId) {
        return fileObjectRepo.listByNotebook(request.query.notebookId, request.query.cursor, limit)
      }
      return fileObjectRepo.list(request.query.cursor, limit)
    })

    app.get<{
      Params: { id: string }
      Reply: FileObject | { message: string }
    }>('/file-objects/:id', async (request, reply) => {
      const fileObject = fileObjectRepo.findById(request.params.id)
      if (!fileObject) {
        reply.code(404)
        return { message: 'FileObject not found' }
      }
      return fileObject
    })

    app.get<{
      Params: { id: string }
    }>('/file-objects/:id/download', async (request, reply) => {
      const fileObject = fileObjectRepo.findById(request.params.id)
      if (!fileObject) {
        reply.code(404)
        return { message: 'FileObject not found' }
      }

      const filePath = parseFileResource(fileObject.resource)
      const data = fileStore.read(filePath)
      if (!data) {
        reply.code(404)
        return { message: 'File data not found' }
      }

      reply.header('Content-Disposition', `attachment; filename="${fileObject.name}"`)
      reply.type(fileObject.contentType)
      return reply.send(data)
    })

    app.get<{
      Params: { id: string }
      Querystring: { afterRevision?: string }
      Reply: { events: ISerializedEvent[] }
    }>('/file-objects/:id/events', async (request) => {
      const { id } = request.params
      const raw = request.query.afterRevision
      const fromRevision = raw !== undefined ? BigInt(raw) + 1n : 0n
      const streamName = FileObjectAggregate.getStreamName(id)
      const persisted = await eventStore.getEventsForAggregateFromRevision(streamName, fromRevision)
      const events = persisted.map((e) => toSerializedEvent(e))
      return { events }
    })

    app.post<{
      Body: FileObjectCommand & { revision?: string }
      Reply: CommandResponse
    }>('/file-objects/commands', async (request, reply) => {
      const metadata: EventMetadata = {
        correlationId: (request.headers['x-request-id'] as string) ?? uuidv4(),
        commandId: request.headers['x-command-id'] as string | undefined,
      }

      try {
        if (request.isMultipart()) {
          return await handleCreateFileObject(request, reply, metadata)
        }

        const command = request.body

        switch (command.type) {
          case 'DeleteFileObject': {
            if (!validateDeleteFileObject(command.data)) {
              reply.code(400)
              return { message: 'Invalid data', details: validateDeleteFileObject.errors }
            }
            if (typeof command.revision !== 'string') {
              reply.code(400)
              return { message: 'revision is required' }
            }
            const aggregate = await fileObjectRepo.getById(command.data.id)
            if (!aggregate) {
              reply.code(404)
              return { message: 'FileObject not found', details: { id: command.data.id } }
            }
            const fileObj = fileObjectRepo.findById(command.data.id)
            const expectedRevision = BigInt(command.revision)
            aggregate.markDeleted(metadata)
            const result = await fileObjectRepo.save(aggregate, expectedRevision)
            if (!result.ok) {
              reply.code(result.error.code ?? 500)
              return { message: result.error.message }
            }
            if (fileObj) {
              fileStore.delete(parseFileResource(fileObj.resource))
            }
            return toCommandSuccess(
              command.data.id,
              result.value.nextExpectedRevision,
              result.value.events ?? [],
            )
          }

          default:
            reply.code(400)
            return {
              message: 'Unknown command type',
              details: { type: (command as { type: string }).type },
            }
        }
      } catch (error) {
        reply.code(500)
        return { message: error instanceof Error ? error.message : String(error) }
      }
    })

    app.get<{
      Querystring: { cursor?: string; limit?: string }
      Reply: { events: object[]; nextCursor: string | null }
    }>('/events/file-objects', async (request) => {
      const limit = parseInt(request.query.limit ?? '100', 10)
      const cursor = request.query.cursor
      const afterPosition = cursor ? BigInt(cursor) : undefined

      const events = eventStore
        .getGlobalEvents(afterPosition, limit + 1)
        .filter((e) => e.streamId.startsWith('FileObject-'))

      const items = events.slice(0, limit)
      const hasMore = events.length > limit
      const serialized = items.map((e) => toSerializedEvent(e))
      const lastEvent = items[items.length - 1]
      const nextCursor = hasMore && lastEvent ? String(lastEvent.position) : null

      return { events: serialized, nextCursor }
    })

    // --- Multipart upload handler ---

    async function handleCreateFileObject(
      request: FastifyRequest,
      reply: FastifyReply,
      metadata: EventMetadata,
    ): Promise<CommandResponse> {
      const file = await request.file()
      if (!file) {
        reply.code(400)
        return { message: 'File is required' }
      }

      const noteIdField = file.fields['noteId'] as MultipartValue<string> | undefined
      if (
        !noteIdField ||
        noteIdField.type !== 'field' ||
        typeof noteIdField.value !== 'string' ||
        noteIdField.value.length === 0
      ) {
        reply.code(400)
        return { message: 'noteId is required' }
      }

      const noteId = noteIdField.value
      const note = noteRepo.findById(noteId)
      if (!note) {
        reply.code(404)
        return { message: 'Note not found', details: { noteId } }
      }

      const buffer = await file.toBuffer()
      const id = uuidv4()
      const filePath = fileStore.save(id, buffer)
      const resource = encodeFileResource(filePath)

      const aggregate = new FileObjectAggregate()
      aggregate.create(
        {
          noteId,
          name: file.filename,
          contentType: file.mimetype,
          resource,
          size: buffer.length,
        },
        id,
        metadata,
      )

      const result = await fileObjectRepo.save(aggregate, EventExistenceRevision.NoStream)
      if (!result.ok) {
        reply.code(result.error.code ?? 500)
        return { message: result.error.message }
      }

      return toCommandSuccess(id, result.value.nextExpectedRevision, result.value.events ?? [])
    }
  }
}
