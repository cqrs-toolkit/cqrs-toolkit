/**
 * Note API routes — thin wiring between HTTP and aggregate/repository.
 */

import type { DemoEventStore } from '@cqrs-toolkit/demo-base/common/server'
import type { CommandResponse, CommandSuccessResponse } from '@cqrs-toolkit/demo-base/common/shared'
import { NotebookRepository } from '@cqrs-toolkit/demo-base/notebooks/server'
import {
  NoteAggregate,
  type NoteRepository,
  type NoteServerEvent,
} from '@cqrs-toolkit/demo-base/notes/server'
import {
  type ListNotesResponse,
  type Note,
  type NoteCommand,
  createNotePayloadSchema,
  deleteNotePayloadSchema,
  updateNoteBodyPayloadSchema,
  updateNoteTitlePayloadSchema,
} from '@cqrs-toolkit/demo-base/notes/shared'
import {
  EventExistenceRevision,
  type EventMetadata,
  type IEvent,
  type ISerializedEvent,
  type Persisted,
} from '@meticoeus/ddd-es'
import { Ajv } from 'ajv'
import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import { v4 as uuidv4 } from 'uuid'

const ajv = new Ajv()

const validateCreateNote = ajv.compile(createNotePayloadSchema)
const validateUpdateNoteTitle = ajv.compile(updateNoteTitlePayloadSchema)
const validateUpdateNoteBody = ajv.compile(updateNoteBodyPayloadSchema)
const validateDeleteNote = ajv.compile(deleteNotePayloadSchema)

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
  events: Persisted<NoteServerEvent>[],
): CommandSuccessResponse {
  return {
    id: aggregateId,
    nextExpectedRevision: String(nextExpectedRevision),
    events: events.map((e) => toSerializedEvent(e as Persisted<IEvent>)),
  }
}

export function noteRoutes(
  eventStore: DemoEventStore,
  noteRepo: NoteRepository,
  notebookRepo: NotebookRepository,
): FastifyPluginAsync {
  return async function routes(app: FastifyInstance): Promise<void> {
    app.get<{
      Querystring: { cursor?: string; limit?: string; notebookId?: string }
      Reply: ListNotesResponse
    }>('/notes', async (request) => {
      const limit = parseInt(request.query.limit ?? '50', 10)
      if (request.query.notebookId) {
        return noteRepo.listByNotebook(request.query.notebookId, request.query.cursor, limit)
      }
      return noteRepo.list(request.query.cursor, limit)
    })

    app.get<{
      Params: { id: string }
      Reply: Note | { message: string }
    }>('/notes/:id', async (request, reply) => {
      const note = noteRepo.findById(request.params.id)
      if (!note) {
        reply.code(404)
        return { message: 'Note not found' }
      }
      return note
    })

    app.get<{
      Params: { id: string }
      Querystring: { afterRevision?: string }
      Reply: { events: ISerializedEvent[] }
    }>('/notes/:id/events', async (request) => {
      const { id } = request.params
      const raw = request.query.afterRevision
      const fromRevision = raw !== undefined ? BigInt(raw) + 1n : 0n
      const streamName = NoteAggregate.getStreamName(id)
      const persisted = await eventStore.getEventsForAggregateFromRevision(streamName, fromRevision)
      const events = persisted.map((e) => toSerializedEvent(e))
      return { events }
    })

    app.post<{
      Body: NoteCommand & { revision?: string }
      Reply: CommandResponse
    }>('/notes/commands', async (request, reply) => {
      const command = request.body
      const metadata: EventMetadata = {
        correlationId: (request.headers['x-request-id'] as string) ?? uuidv4(),
        commandId: request.headers['x-command-id'] as string | undefined,
      }

      try {
        switch (command.type) {
          case 'CreateNote': {
            if (!validateCreateNote(command.data)) {
              reply.code(400)
              return { message: 'Invalid data', details: validateCreateNote.errors }
            }
            const notebook = notebookRepo.findById(command.data.notebookId)
            if (!notebook) {
              reply.code(404)
              return {
                message: 'Notebook not found',
                details: { notebookId: command.data.notebookId },
              }
            }
            const id = uuidv4()
            const aggregate = new NoteAggregate()
            aggregate.create(command.data, id, metadata)
            const result = await noteRepo.save(aggregate, EventExistenceRevision.NoStream)
            if (!result.ok) {
              reply.code(result.error.code ?? 500)
              return { message: result.error.message }
            }
            return toCommandSuccess(
              id,
              result.value.nextExpectedRevision,
              result.value.events ?? [],
            )
          }

          case 'UpdateNoteTitle': {
            if (!validateUpdateNoteTitle(command.data)) {
              reply.code(400)
              return { message: 'Invalid data', details: validateUpdateNoteTitle.errors }
            }
            if (typeof command.revision !== 'string') {
              reply.code(400)
              return { message: 'revision is required' }
            }
            const aggregate = await noteRepo.getById(command.data.id)
            if (!aggregate) {
              reply.code(404)
              return { message: 'Note not found', details: { id: command.data.id } }
            }
            const expectedRevision = BigInt(command.revision)
            aggregate.updateTitle(command.data, metadata)
            const result = await noteRepo.save(aggregate, expectedRevision)
            if (!result.ok) {
              reply.code(result.error.code ?? 500)
              return { message: result.error.message }
            }
            return toCommandSuccess(
              command.data.id,
              result.value.nextExpectedRevision,
              result.value.events ?? [],
            )
          }

          case 'UpdateNoteBody': {
            if (!validateUpdateNoteBody(command.data)) {
              reply.code(400)
              return { message: 'Invalid data', details: validateUpdateNoteBody.errors }
            }
            if (typeof command.revision !== 'string') {
              reply.code(400)
              return { message: 'revision is required' }
            }
            const aggregate = await noteRepo.getById(command.data.id)
            if (!aggregate) {
              reply.code(404)
              return { message: 'Note not found', details: { id: command.data.id } }
            }
            const expectedRevision = BigInt(command.revision)
            aggregate.updateBody(command.data, metadata)
            const result = await noteRepo.save(aggregate, expectedRevision)
            if (!result.ok) {
              reply.code(result.error.code ?? 500)
              return { message: result.error.message }
            }
            return toCommandSuccess(
              command.data.id,
              result.value.nextExpectedRevision,
              result.value.events ?? [],
            )
          }

          case 'DeleteNote': {
            if (!validateDeleteNote(command.data)) {
              reply.code(400)
              return { message: 'Invalid data', details: validateDeleteNote.errors }
            }
            if (typeof command.revision !== 'string') {
              reply.code(400)
              return { message: 'revision is required' }
            }
            const aggregate = await noteRepo.getById(command.data.id)
            if (!aggregate) {
              reply.code(404)
              return { message: 'Note not found', details: { id: command.data.id } }
            }
            const expectedRevision = BigInt(command.revision)
            aggregate.markDeleted(metadata)
            const result = await noteRepo.save(aggregate, expectedRevision)
            if (!result.ok) {
              reply.code(result.error.code ?? 500)
              return { message: result.error.message }
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
    }>('/events/notes', async (request) => {
      const limit = parseInt(request.query.limit ?? '100', 10)
      const cursor = request.query.cursor
      const afterPosition = cursor ? BigInt(cursor) : undefined

      const events = eventStore
        .getGlobalEvents(afterPosition, limit + 1)
        .filter((e) => e.streamId.startsWith('Note-'))

      const items = events.slice(0, limit)
      const hasMore = events.length > limit
      const serialized = items.map((e) => toSerializedEvent(e))
      const lastEvent = items[items.length - 1]
      const nextCursor = hasMore && lastEvent ? String(lastEvent.position) : null

      return { events: serialized, nextCursor }
    })
  }
}
