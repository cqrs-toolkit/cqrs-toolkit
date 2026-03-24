/**
 * Todo collection query — dispatches to versioned resolvers via ProfileHandler.
 */

import type { TodoRepository } from '@cqrs-toolkit/demo-base/todos/server'
import { Hypermedia, ProfileHandler } from '@cqrs-toolkit/hypermedia/server'
import type { FastifyReply } from 'fastify'
import { handleProfileHandler } from '../../query-utils.js'
import { GetTodosV1_0_0 } from './v1_0_0/GetTodos.js'
import { TodoRepV1_0_0 } from './v1_0_0/representation.js'

export namespace GetTodos {
  const profileHandler = new ProfileHandler<true, TodoRepository, void>({
    representations: [
      {
        version: TodoRepV1_0_0.version,
        urn: TodoRepV1_0_0.collection.profile,
        resolve: (request, reply, todoRepo) => {
          return GetTodosV1_0_0.resolve(request, reply, todoRepo)
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
  export const schema = GetTodosV1_0_0.schema

  export function resolve(
    request: Hypermedia.Request,
    reply: FastifyReply,
    todoRepo: TodoRepository,
  ): Promise<void> {
    return handleProfileHandler(reply, profileHandler.resolve(request, reply, todoRepo, undefined))
  }
}
