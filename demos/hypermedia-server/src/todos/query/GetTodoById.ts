/**
 * Todo resource query — dispatches to versioned resolvers via ProfileHandler.
 */

import type { TodoRepository } from '@cqrs-toolkit/demo-base/todos/server'
import { Hypermedia, ProfileHandler } from '@cqrs-toolkit/hypermedia/server'
import type { FastifyReply } from 'fastify'
import { handleProfileHandler } from '../../query-utils.js'
import { GetTodoByIdV1_0_0 } from './v1_0_0/GetTodoById.js'
import { TodoRepV1_0_0 } from './v1_0_0/representation.js'

interface Request extends Hypermedia.Request {
  params: { id: string }
}

export namespace GetTodoById {
  const profileHandler = new ProfileHandler<true, TodoRepository, void, Request>({
    representations: [
      {
        version: TodoRepV1_0_0.version,
        urn: TodoRepV1_0_0.resource.profile,
        resolve: (request, reply, todoRepo) => {
          return GetTodoByIdV1_0_0.resolve(request, reply, todoRepo)
        },
      },
    ],
  })

  /**
   * Fastify route schema.
   * Currently delegates to the latest version's schema.
   * Multi-version schema strategy TBD — if the latest is backwards compatible, use it
   * directly; otherwise oneOf or similar construct.
   */
  export const schema = GetTodoByIdV1_0_0.schema

  export function resolve(
    request: Request,
    reply: FastifyReply,
    todoRepo: TodoRepository,
  ): Promise<void> {
    return handleProfileHandler(reply, profileHandler.resolve(request, reply, todoRepo, undefined))
  }
}
