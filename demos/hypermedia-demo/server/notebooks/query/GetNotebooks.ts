/**
 * Notebook collection query — dispatches to versioned resolvers via ProfileHandler.
 */

import type { NotebookRepository } from '@cqrs-toolkit/demo-base/notebooks/server'
import { Hypermedia, ProfileHandler } from '@cqrs-toolkit/hypermedia/server'
import type { FastifyReply } from 'fastify'
import { handleProfileHandler } from '../../query-utils.js'
import { GetNotebooksV1_0_0 } from './v1_0_0/GetNotebooks.js'
import { NotebookRepV1_0_0 } from './v1_0_0/representation.js'

export namespace GetNotebooks {
  const profileHandler = new ProfileHandler<true, NotebookRepository, void>({
    representations: [
      {
        version: NotebookRepV1_0_0.version,
        urn: NotebookRepV1_0_0.collection.profile,
        resolve: (request, reply, notebookRepo) => {
          return GetNotebooksV1_0_0.resolve(request, reply, notebookRepo)
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
  export const schema = GetNotebooksV1_0_0.schema

  export function resolve(
    request: Hypermedia.Request,
    reply: FastifyReply,
    notebookRepo: NotebookRepository,
  ): Promise<void> {
    return handleProfileHandler(
      reply,
      profileHandler.resolve(request, reply, notebookRepo, undefined),
    )
  }
}
