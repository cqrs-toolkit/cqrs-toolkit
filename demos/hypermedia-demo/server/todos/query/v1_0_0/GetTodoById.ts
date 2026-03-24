/**
 * Todo resource resolver — v1.0.0.
 */

import type { TodoRepository } from '@cqrs-toolkit/demo-base/todos/server'
import type { HypermediaTypes } from '@cqrs-toolkit/hypermedia'
import {
  Hypermedia,
  NotFoundException,
  type RepliedValue,
  type ResolvedValue,
} from '@cqrs-toolkit/hypermedia/server'
import { Err, Ok, type Result } from '@meticoeus/ddd-es'
import type { FastifyReply } from 'fastify'
import { HalTodo, TodoClass } from '../doc.js'

interface GetByIdRequest extends Hypermedia.Request {
  params: { id: string }
}

export namespace GetTodoByIdV1_0_0 {
  export const schema = {
    params: {
      type: 'object',
      properties: {
        id: { type: 'string' },
      },
      required: ['id'],
    },
  }

  const formatConfig: Hypermedia.ResourceFormatConfig = {
    halDefs: [HalTodo],
  }

  export async function resolve(
    request: GetByIdRequest,
    _reply: FastifyReply,
    todoRepo: TodoRepository,
  ): Promise<Result<ResolvedValue | RepliedValue>> {
    const todo = todoRepo.findById(request.params.id)
    if (!todo) return Err(new NotFoundException())

    const rd: HypermediaTypes.ResourceDescriptor = {
      class: TodoClass,
      properties: todo,
    }

    return Ok({ kind: 'resolved', ...Hypermedia.formatResource(request, rd, formatConfig) })
  }
}
