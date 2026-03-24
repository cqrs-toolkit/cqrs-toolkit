/**
 * Todo collection resolver — v1.0.0.
 */

import type { TodoRepository } from '@cqrs-toolkit/demo-base/todos/server'
import type { Todo } from '@cqrs-toolkit/demo-base/todos/shared'
import type { CursorPagination, HypermediaTypes } from '@cqrs-toolkit/hypermedia'
import { Hypermedia, type RepliedValue, type ResolvedValue } from '@cqrs-toolkit/hypermedia/server'
import { Ok, type Result } from '@meticoeus/ddd-es'
import type { FastifyReply } from 'fastify'
import { HalTodo, HalTodoCollection, TodoClass } from '../doc.js'
import { TodoRepV1_0_0 } from './representation.js'

export namespace GetTodosV1_0_0 {
  export const schema = {
    querystring: {
      type: 'object',
      properties: {
        cursor: { type: 'string' },
        limit: { type: 'string' },
      },
      additionalProperties: false,
    },
  }

  const formatConfig: Hypermedia.CollectionFormatConfig = {
    halDefs: [HalTodo],
    collectionDef: HalTodoCollection,
    linkDensity: 'lean',
  }

  export async function resolve(
    request: Hypermedia.Request,
    _reply: FastifyReply,
    todoRepo: TodoRepository,
  ): Promise<Result<ResolvedValue | RepliedValue>> {
    const queryParams = request.query
    const limit = parseInt((queryParams?.['limit'] as string) ?? '50', 10)
    const cursor = queryParams?.['cursor'] as string | undefined

    const result = todoRepo.list(cursor, limit)

    const connection: CursorPagination.Connection<Todo> = {
      entities: result.items,
      nextCursor: result.nextCursor,
    }

    const page = Hypermedia.pageViewFromCursor(connection, {
      path: TodoRepV1_0_0.collectionHref,
      query: queryParams,
    })

    const cd = Hypermedia.buildCollectionDescriptor<Todo>({
      connection,
      page,
      buildMember: (data): HypermediaTypes.ResourceDescriptor => ({
        class: TodoClass,
        properties: data,
      }),
    })

    return Ok({ kind: 'resolved', ...Hypermedia.formatCollection(request, cd, formatConfig) })
  }
}
