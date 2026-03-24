/**
 * Todo API routes — thin wiring between HTTP and aggregate/repository.
 */

import type { DemoEventStore } from '@cqrs-toolkit/demo-base/common/server'
import type { CommandResponse, CommandSuccessResponse } from '@cqrs-toolkit/demo-base/common/shared'
import {
  TodoAggregate,
  type TodoRepository,
  type TodoServerEvent,
} from '@cqrs-toolkit/demo-base/todos/server'
import {
  type ListTodosResponse,
  type Todo,
  type TodoCommand,
  changeTodoStatusPayloadSchema,
  createTodoPayloadSchema,
  deleteTodoPayloadSchema,
  updateTodoContentPayloadSchema,
} from '@cqrs-toolkit/demo-base/todos/shared'
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
      Body: TodoCommand & { revision?: string }
      Reply: CommandResponse
    }>('/todos/commands', async (request, reply) => {
      const command = request.body
      const metadata: EventMetadata = {
        correlationId: (request.headers['x-request-id'] as string) ?? uuidv4(),
        commandId: request.headers['x-command-id'] as string | undefined,
      }

      try {
        switch (command.type) {
          case 'CreateTodo': {
            if (!validateCreateTodo(command.data)) {
              reply.code(400)
              return { message: 'Invalid data', details: validateCreateTodo.errors }
            }
            const id = uuidv4()
            const aggregate = new TodoAggregate()
            aggregate.create(command.data, id, metadata)
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
            if (!validateUpdateTodoContent(command.data)) {
              reply.code(400)
              return { message: 'Invalid data', details: validateUpdateTodoContent.errors }
            }
            if (typeof command.revision !== 'string') {
              reply.code(400)
              return { message: 'revision is required' }
            }
            const aggregate = await todoRepo.getById(command.data.id)
            if (!aggregate) {
              reply.code(404)
              return { message: 'Todo not found', details: { id: command.data.id } }
            }
            const expectedRevision = BigInt(command.revision)
            aggregate.updateContent(command.data, metadata)
            const result = await todoRepo.save(aggregate, expectedRevision)
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

          case 'ChangeTodoStatus': {
            if (!validateChangeTodoStatus(command.data)) {
              reply.code(400)
              return { message: 'Invalid data', details: validateChangeTodoStatus.errors }
            }
            if (typeof command.revision !== 'string') {
              reply.code(400)
              return { message: 'revision is required' }
            }
            const aggregate = await todoRepo.getById(command.data.id)
            if (!aggregate) {
              reply.code(404)
              return { message: 'Todo not found', details: { id: command.data.id } }
            }
            const expectedRevision = BigInt(command.revision)
            aggregate.changeStatus(command.data, metadata)
            const result = await todoRepo.save(aggregate, expectedRevision)
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

          case 'DeleteTodo': {
            if (!validateDeleteTodo(command.data)) {
              reply.code(400)
              return { message: 'Invalid data', details: validateDeleteTodo.errors }
            }
            if (typeof command.revision !== 'string') {
              reply.code(400)
              return { message: 'revision is required' }
            }
            const aggregate = await todoRepo.getById(command.data.id)
            if (!aggregate) {
              reply.code(404)
              return { message: 'Todo not found', details: { id: command.data.id } }
            }
            const expectedRevision = BigInt(command.revision)
            aggregate.markDeleted(metadata)
            const result = await todoRepo.save(aggregate, expectedRevision)
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
