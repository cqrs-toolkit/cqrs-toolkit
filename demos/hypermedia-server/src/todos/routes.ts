/**
 * Todo API routes — command and query registration.
 */

import { DemoEventStore } from '@cqrs-toolkit/demo-base/common/server'
import type { CommandResponse } from '@cqrs-toolkit/demo-base/common/shared'
import { TodoAggregate, TodoRepository } from '@cqrs-toolkit/demo-base/todos/server'
import type { EventCursorPagination, HypermediaTypes } from '@cqrs-toolkit/hypermedia'
import { Hypermedia } from '@cqrs-toolkit/hypermedia/server'
import { EventExistenceRevision, type ISerializedEvent } from '@meticoeus/ddd-es'
import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import { v4 as uuidv4 } from 'uuid'
import {
  commandRouteConfig,
  createRouteConfig,
  extractCommandMetadata,
  handleErr,
  toCommandSuccess,
  toSerializedEvent,
} from '../command-utils.js'
import {
  GetAggregateEventsRequest,
  GetByIdRequest,
  GetItemEventsRequest,
  GetListRequest,
} from '../query-utils.js'
import { TodoCommandIds, TodoCommands } from './command/doc.js'
import { TODO_COMMANDS, type TodoMutationCommand } from './command/planner.js'
import { GetTodoById } from './query/GetTodoById.js'
import { GetTodos } from './query/GetTodos.js'
import {
  HalTodoAggregateEvent,
  HalTodoAggregateEventCollection,
  HalTodoItemEvent,
  HalTodoItemEventCollection,
  TodoAggregateEventClass,
  TodoItemEventClass,
} from './query/doc.js'
import { TodoRepV1_0_0 } from './query/v1_0_0/representation.js'

const itemEventsFormatConfig: Hypermedia.CollectionFormatConfig = {
  halDefs: [HalTodoItemEvent],
  collectionDef: HalTodoItemEventCollection,
  linkDensity: 'omit',
}

const aggregateEventsFormatConfig: Hypermedia.CollectionFormatConfig = {
  halDefs: [HalTodoAggregateEvent],
  collectionDef: HalTodoAggregateEventCollection,
  linkDensity: 'omit',
}

export function todoRoutes(
  eventStore: DemoEventStore,
  todoRepo: TodoRepository,
): FastifyPluginAsync {
  return async function routes(app: FastifyInstance): Promise<void> {
    // ── Query routes ──

    app.get<GetListRequest>(
      TodoRepV1_0_0.collectionHref,
      { schema: GetTodos.schema },
      async (request, reply) => {
        await GetTodos.resolve(request, reply, todoRepo)
      },
    )

    app.get<GetByIdRequest>(
      TodoRepV1_0_0.resourcePath,
      { schema: GetTodoById.schema },
      async (request, reply) => {
        await GetTodoById.resolve(request, reply, todoRepo)
      },
    )

    app.get<GetItemEventsRequest>(TodoRepV1_0_0.itemEvents.path, async (request, reply) => {
      const { id } = request.params
      const raw = request.query.afterRevision
      const fromRevision = raw !== undefined ? BigInt(raw) + 1n : 0n
      const streamName = TodoAggregate.getStreamName(id)
      const persisted = await eventStore.getEventsForAggregateFromRevision(streamName, fromRevision)
      const serialized = persisted.map((e) => toSerializedEvent(e))

      const connection: EventCursorPagination.Connection<ISerializedEvent> = {
        entities: serialized,
        nextCursor: null, // item events return all from revision, no paging
      }
      const page = Hypermedia.eventPageViewFromCursor(connection, {
        path: TodoRepV1_0_0.itemEvents.hrefBase.replace('{id}', id),
        query: request.query,
        revision: true,
      })
      const cd = Hypermedia.buildCollectionDescriptor({
        connection,
        page,
        buildMember: (data): HypermediaTypes.ResourceDescriptor => ({
          class: TodoItemEventClass,
          properties: data,
        }),
        context: { id },
      })
      const { contentType, body } = Hypermedia.formatCollection(request, cd, itemEventsFormatConfig)
      reply.type(contentType).send(body)
    })

    app.get<GetAggregateEventsRequest>(
      TodoRepV1_0_0.aggregateEvents.path,
      async (request, reply) => {
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

        const connection: EventCursorPagination.Connection<ISerializedEvent> = {
          entities: serialized,
          nextCursor,
        }
        const page = Hypermedia.eventPageViewFromCursor(connection, {
          path: TodoRepV1_0_0.aggregateEvents.hrefBase,
          query: request.query,
        })
        const cd = Hypermedia.buildCollectionDescriptor({
          connection,
          page,
          buildMember: (data): HypermediaTypes.ResourceDescriptor => ({
            class: TodoAggregateEventClass,
            properties: data,
          }),
        })
        const { contentType, body } = Hypermedia.formatCollection(
          request,
          cd,
          aggregateEventsFormatConfig,
        )
        reply.type(contentType).send(body)
      },
    )

    // ── Create route ──

    app.post(TodoCommands.mustSurface('create').path, createRouteConfig, async (request, reply) => {
      const metadataRes = extractCommandMetadata(request)
      if (!metadataRes.ok) return handleErr(metadataRes, reply)
      const metadata = metadataRes.value

      const valRes = TODO_COMMANDS.parse<{ content: string }>(
        request,
        reply,
        request.body,
        TodoCommandIds.CreateTodo,
      )
      if (!valRes.ok) {
        reply.code(400)
        return { message: valRes.error.message } satisfies CommandResponse
      }
      if (valRes.value.kind === 'replied') return

      const id = uuidv4()
      const aggregate = new TodoAggregate()
      aggregate.create(valRes.value.value, id, metadata)
      const result = await todoRepo.save(aggregate, EventExistenceRevision.NoStream)
      if (!result.ok) {
        reply.code(result.error.code ?? 500)
        return { message: result.error.message } satisfies CommandResponse
      }
      return toCommandSuccess(id, result.value.nextExpectedRevision, result.value.events ?? [])
    })

    // ── Command envelope route ──

    app.post<{
      Params: { id: string }
      Body: { type: string; data: unknown; revision?: string }
    }>(TodoCommands.mustSurface('command').path, commandRouteConfig, async (request, reply) => {
      const metadataRes = extractCommandMetadata(request)
      if (!metadataRes.ok) return handleErr(metadataRes, reply)
      const metadata = metadataRes.value

      const { type, data, revision } = request.body
      const res = TODO_COMMANDS.parseCommandDispatch<TodoMutationCommand>(
        request,
        reply,
        data,
        type,
      )
      if (!res.ok) {
        reply.code(400)
        return { message: res.error.message } satisfies CommandResponse
      }
      if (res.value.kind === 'replied') return

      const aggregate = await todoRepo.getById(request.params.id)
      if (!aggregate) {
        reply.code(404)
        return { message: 'Todo not found' } satisfies CommandResponse
      }

      const expectedRevision = revision !== undefined ? BigInt(revision) : undefined
      const { stableId } = res.value

      switch (stableId) {
        case TodoCommandIds.UpdateTodoContent:
          aggregate.updateContent(res.value.data, metadata)
          break
        case TodoCommandIds.ChangeTodoStatus:
          aggregate.changeStatus(res.value.data, metadata)
          break
        case TodoCommandIds.DeleteTodo:
          aggregate.markDeleted(metadata)
          break
        default:
          reply.code(400)
          return { message: `Unknown command: ${stableId}` } satisfies CommandResponse
      }

      const saveRes = await todoRepo.save(aggregate, expectedRevision ?? 0n)
      if (!saveRes.ok) {
        reply.code(saveRes.error.code ?? 500)
        return { message: saveRes.error.message } satisfies CommandResponse
      }
      return toCommandSuccess(
        request.params.id,
        saveRes.value.nextExpectedRevision,
        saveRes.value.events ?? [],
      )
    })
  }
}
