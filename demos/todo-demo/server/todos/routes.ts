/**
 * Todo API routes — thin wiring between HTTP and aggregate/repository.
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
import type { TodoCommand } from '../../shared/todos/commands.js'
import {
  changeTodoStatusPayloadSchema,
  createTodoPayloadSchema,
  deleteTodoPayloadSchema,
  updateTodoContentPayloadSchema,
} from '../../shared/todos/commands.js'
import type { ListTodosResponse, Todo } from '../../shared/todos/types.js'
import type { CommandResponse, CommandSuccessResponse } from '../../shared/types.js'
import type { DemoEventStore } from '../event-store.js'
import { TodoAggregate, type TodoServerEvent } from './aggregate.js'
import type { TodoRepository } from './repository.js'

const ajv = new Ajv()

const validateCreateTodo = ajv.compile(createTodoPayloadSchema)
const validateUpdateTodoContent = ajv.compile(updateTodoContentPayloadSchema)
const validateChangeTodoStatus = ajv.compile(changeTodoStatusPayloadSchema)
const validateDeleteTodo = ajv.compile(deleteTodoPayloadSchema)

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
  events: Persisted<TodoServerEvent>[],
): CommandSuccessResponse {
  return {
    id: aggregateId,
    nextExpectedRevision: String(nextExpectedRevision),
    events: events.map((e) => toSerializedEvent(e as Persisted<IEvent>)),
  }
}

export function todoRoutes(
  eventStore: DemoEventStore,
  todoRepo: TodoRepository,
): FastifyPluginAsync {
  return async function routes(app: FastifyInstance): Promise<void> {
    app.get<{
      Querystring: { cursor?: string; limit?: string }
      Reply: ListTodosResponse
    }>('/todos', async (request) => {
      const limit = parseInt(request.query.limit ?? '50', 10)
      return todoRepo.list(request.query.cursor, limit)
    })

    app.get<{
      Params: { id: string }
      Reply: Todo | { message: string }
    }>('/todos/:id', async (request, reply) => {
      const todo = todoRepo.findById(request.params.id)
      if (!todo) {
        reply.code(404)
        return { message: 'Todo not found' }
      }
      return todo
    })

    app.get<{
      Params: { id: string }
      Querystring: { afterRevision?: string }
      Reply: { events: ISerializedEvent[] }
    }>('/todos/:id/events', async (request) => {
      const { id } = request.params
      const raw = request.query.afterRevision
      const fromRevision = raw !== undefined ? BigInt(raw) + 1n : 0n
      const streamName = TodoAggregate.getStreamName(id)
      const persisted = await eventStore.getEventsForAggregateFromRevision(streamName, fromRevision)
      const events = persisted.map((e) => toSerializedEvent(e))
      return { events }
    })

    app.post<{
      Body: TodoCommand
      Reply: CommandResponse
    }>('/todos/commands', async (request, reply) => {
      const command = request.body
      const metadata: EventMetadata = {
        correlationId: (request.headers['x-request-id'] as string) ?? uuidv4(),
      }

      try {
        switch (command.type) {
          case 'CreateTodo': {
            if (!validateCreateTodo(command.payload)) {
              reply.code(400)
              return { message: 'Invalid payload', details: validateCreateTodo.errors }
            }
            const id = uuidv4()
            const aggregate = new TodoAggregate()
            aggregate.create(command.payload, id, metadata)
            const result = await todoRepo.save(aggregate, EventExistenceRevision.NoStream)
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

          case 'UpdateTodoContent': {
            if (!validateUpdateTodoContent(command.payload)) {
              reply.code(400)
              return { message: 'Invalid payload', details: validateUpdateTodoContent.errors }
            }
            const aggregate = await todoRepo.getById(command.payload.id)
            if (!aggregate) {
              reply.code(404)
              return { message: 'Todo not found', details: { id: command.payload.id } }
            }
            const expectedRevision = BigInt(command.payload.revision)
            aggregate.updateContent(command.payload, metadata)
            const result = await todoRepo.save(aggregate, expectedRevision)
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

          case 'ChangeTodoStatus': {
            if (!validateChangeTodoStatus(command.payload)) {
              reply.code(400)
              return { message: 'Invalid payload', details: validateChangeTodoStatus.errors }
            }
            const aggregate = await todoRepo.getById(command.payload.id)
            if (!aggregate) {
              reply.code(404)
              return { message: 'Todo not found', details: { id: command.payload.id } }
            }
            const expectedRevision = BigInt(command.payload.revision)
            aggregate.changeStatus(command.payload, metadata)
            const result = await todoRepo.save(aggregate, expectedRevision)
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

          case 'DeleteTodo': {
            if (!validateDeleteTodo(command.payload)) {
              reply.code(400)
              return { message: 'Invalid payload', details: validateDeleteTodo.errors }
            }
            const aggregate = await todoRepo.getById(command.payload.id)
            if (!aggregate) {
              reply.code(404)
              return { message: 'Todo not found', details: { id: command.payload.id } }
            }
            const expectedRevision = BigInt(command.payload.revision)
            aggregate.markDeleted(metadata)
            const result = await todoRepo.save(aggregate, expectedRevision)
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
    }>('/events/todos', async (request) => {
      const limit = parseInt(request.query.limit ?? '100', 10)
      const cursor = request.query.cursor
      const afterPosition = cursor ? BigInt(cursor) : undefined

      const events = eventStore
        .getGlobalEvents(afterPosition, limit + 1)
        .filter((e) => e.streamId.startsWith('Todo-'))

      const items = events.slice(0, limit)
      const hasMore = events.length > limit
      const serialized = items.map((e) => toSerializedEvent(e))
      const lastEvent = items[items.length - 1]
      const nextCursor = hasMore && lastEvent ? String(lastEvent.position) : null

      return { events: serialized, nextCursor }
    })
  }
}
