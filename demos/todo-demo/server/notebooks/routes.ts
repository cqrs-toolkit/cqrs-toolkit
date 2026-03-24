/**
 * Notebook API routes — thin wiring between HTTP and aggregate/repository/service.
 */

import type { DemoEventStore } from '@cqrs-toolkit/demo-base/common/server'
import type { CommandResponse, CommandSuccessResponse } from '@cqrs-toolkit/demo-base/common/shared'
import {
  NotebookAggregate,
  type NotebookRepository,
  type NotebookServerEvent,
  type NotebookService,
} from '@cqrs-toolkit/demo-base/notebooks/server'
import {
  DuplicateNotebookNameException,
  type ListNotebooksResponse,
  type Notebook,
  type NotebookCommand,
  createNotebookPayloadSchema,
  deleteNotebookPayloadSchema,
  updateNotebookNamePayloadSchema,
} from '@cqrs-toolkit/demo-base/notebooks/shared'
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

const validateCreateNotebook = ajv.compile(createNotebookPayloadSchema)
const validateUpdateNotebookName = ajv.compile(updateNotebookNamePayloadSchema)
const validateDeleteNotebook = ajv.compile(deleteNotebookPayloadSchema)

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
  events: Persisted<NotebookServerEvent>[],
): CommandSuccessResponse {
  return {
    id: aggregateId,
    nextExpectedRevision: String(nextExpectedRevision),
    events: events.map((e) => toSerializedEvent(e as Persisted<IEvent>)),
  }
}

export function notebookRoutes(
  eventStore: DemoEventStore,
  notebookRepo: NotebookRepository,
  notebookService: NotebookService,
): FastifyPluginAsync {
  return async function routes(app: FastifyInstance): Promise<void> {
    app.get<{
      Querystring: { cursor?: string; limit?: string }
      Reply: ListNotebooksResponse
    }>('/notebooks', async (request) => {
      const limit = parseInt(request.query.limit ?? '50', 10)
      return notebookRepo.list(request.query.cursor, limit)
    })

    app.get<{
      Params: { id: string }
      Reply: Notebook | { message: string }
    }>('/notebooks/:id', async (request, reply) => {
      const notebook = notebookRepo.findById(request.params.id)
      if (!notebook) {
        reply.code(404)
        return { message: 'Notebook not found' }
      }
      return notebook
    })

    app.get<{
      Params: { id: string }
      Querystring: { afterRevision?: string }
      Reply: { events: ISerializedEvent[] }
    }>('/notebooks/:id/events', async (request) => {
      const { id } = request.params
      const raw = request.query.afterRevision
      const fromRevision = raw !== undefined ? BigInt(raw) + 1n : 0n
      const streamName = NotebookAggregate.getStreamName(id)
      const persisted = await eventStore.getEventsForAggregateFromRevision(streamName, fromRevision)
      const events = persisted.map((e) => toSerializedEvent(e))
      return { events }
    })

    app.post<{
      Body: NotebookCommand & { revision?: string }
      Reply: CommandResponse
    }>('/notebooks/commands', async (request, reply) => {
      const command = request.body
      const metadata: EventMetadata = {
        correlationId: (request.headers['x-request-id'] as string) ?? uuidv4(),
        commandId: request.headers['x-command-id'] as string | undefined,
      }

      try {
        switch (command.type) {
          case 'CreateNotebook': {
            if (!validateCreateNotebook(command.data)) {
              reply.code(400)
              return { message: 'Invalid data', details: validateCreateNotebook.errors }
            }
            const existing = notebookRepo.findByName(command.data.name)
            if (existing) {
              const err = new DuplicateNotebookNameException(command.data.name)
              reply.code(400)
              return { message: err.message, details: { errors: err.details } }
            }
            const id = uuidv4()
            const aggregate = new NotebookAggregate()
            aggregate.create(command.data, id, metadata)
            const result = await notebookRepo.save(aggregate, EventExistenceRevision.NoStream)
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

          case 'UpdateNotebookName': {
            if (!validateUpdateNotebookName(command.data)) {
              reply.code(400)
              return { message: 'Invalid data', details: validateUpdateNotebookName.errors }
            }
            if (typeof command.revision !== 'string') {
              reply.code(400)
              return { message: 'revision is required' }
            }
            const nameConflict = notebookRepo.findByName(command.data.name)
            if (nameConflict && nameConflict.id !== command.data.id) {
              const err = new DuplicateNotebookNameException(command.data.name)
              reply.code(400)
              return { message: err.message, details: { errors: err.details } }
            }
            const aggregate = await notebookRepo.getById(command.data.id)
            if (!aggregate) {
              reply.code(404)
              return { message: 'Notebook not found', details: { id: command.data.id } }
            }
            const expectedRevision = BigInt(command.revision)
            aggregate.updateName(command.data, metadata)
            const result = await notebookRepo.save(aggregate, expectedRevision)
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

          case 'DeleteNotebook': {
            if (!validateDeleteNotebook(command.data)) {
              reply.code(400)
              return { message: 'Invalid data', details: validateDeleteNotebook.errors }
            }
            if (typeof command.revision !== 'string') {
              reply.code(400)
              return { message: 'revision is required' }
            }
            const expectedRevision = BigInt(command.revision)
            const result = await notebookService.deleteNotebook(
              command.data.id,
              expectedRevision,
              metadata,
            )
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
    }>('/events/notebooks', async (request) => {
      const limit = parseInt(request.query.limit ?? '100', 10)
      const cursor = request.query.cursor
      const afterPosition = cursor ? BigInt(cursor) : undefined

      const events = eventStore
        .getGlobalEvents(afterPosition, limit + 1)
        .filter((e) => e.streamId.startsWith('Notebook-'))

      const items = events.slice(0, limit)
      const hasMore = events.length > limit
      const serialized = items.map((e) => toSerializedEvent(e))
      const lastEvent = items[items.length - 1]
      const nextCursor = hasMore && lastEvent ? String(lastEvent.position) : null

      return { events: serialized, nextCursor }
    })
  }
}
