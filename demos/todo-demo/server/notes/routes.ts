/**
 * Note API routes — thin wiring between HTTP and aggregate/repository.
 */

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
import type { NoteCommand } from '../../shared/notes/commands.js'
import {
  createNotePayloadSchema,
  deleteNotePayloadSchema,
  updateNoteBodyPayloadSchema,
  updateNoteTitlePayloadSchema,
} from '../../shared/notes/commands.js'
import type { ListNotesResponse, Note } from '../../shared/notes/types.js'
import type { CommandResponse, CommandSuccessResponse } from '../../shared/types.js'
import type { DemoEventStore } from '../event-store.js'
import { NoteAggregate, type NoteServerEvent } from './aggregate.js'
import type { NoteRepository } from './repository.js'

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
): FastifyPluginAsync {
  return async function routes(app: FastifyInstance): Promise<void> {
    app.get<{
      Querystring: { cursor?: string; limit?: string }
      Reply: ListNotesResponse
    }>('/notes', async (request) => {
      const limit = parseInt(request.query.limit ?? '50', 10)
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
      Body: NoteCommand
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
            if (!validateCreateNote(command.payload)) {
              reply.code(400)
              return { message: 'Invalid payload', details: validateCreateNote.errors }
            }
            const id = uuidv4()
            const aggregate = new NoteAggregate()
            aggregate.create(command.payload, id, metadata)
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
            if (!validateUpdateNoteTitle(command.payload)) {
              reply.code(400)
              return { message: 'Invalid payload', details: validateUpdateNoteTitle.errors }
            }
            const aggregate = await noteRepo.getById(command.payload.id)
            if (!aggregate) {
              reply.code(404)
              return { message: 'Note not found', details: { id: command.payload.id } }
            }
            const expectedRevision = BigInt(command.payload.revision)
            aggregate.updateTitle(command.payload, metadata)
            const result = await noteRepo.save(aggregate, expectedRevision)
            if (!result.ok) {
              reply.code(result.error.code ?? 500)
              return { message: result.error.message }
            }
            return toCommandSuccess(
              command.payload.id,
              result.value.nextExpectedRevision,
              result.value.events ?? [],
            )
          }

          case 'UpdateNoteBody': {
            if (!validateUpdateNoteBody(command.payload)) {
              reply.code(400)
              return { message: 'Invalid payload', details: validateUpdateNoteBody.errors }
            }
            const aggregate = await noteRepo.getById(command.payload.id)
            if (!aggregate) {
              reply.code(404)
              return { message: 'Note not found', details: { id: command.payload.id } }
            }
            const expectedRevision = BigInt(command.payload.revision)
            aggregate.updateBody(command.payload, metadata)
            const result = await noteRepo.save(aggregate, expectedRevision)
            if (!result.ok) {
              reply.code(result.error.code ?? 500)
              return { message: result.error.message }
            }
            return toCommandSuccess(
              command.payload.id,
              result.value.nextExpectedRevision,
              result.value.events ?? [],
            )
          }

          case 'DeleteNote': {
            if (!validateDeleteNote(command.payload)) {
              reply.code(400)
              return { message: 'Invalid payload', details: validateDeleteNote.errors }
            }
            const aggregate = await noteRepo.getById(command.payload.id)
            if (!aggregate) {
              reply.code(404)
              return { message: 'Note not found', details: { id: command.payload.id } }
            }
            const expectedRevision = BigInt(command.payload.revision)
            aggregate.markDeleted(metadata)
            const result = await noteRepo.save(aggregate, expectedRevision)
            if (!result.ok) {
              reply.code(result.error.code ?? 500)
              return { message: result.error.message }
            }
            return toCommandSuccess(
              command.payload.id,
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
