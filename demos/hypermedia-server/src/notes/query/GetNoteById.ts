/**
 * Note resource query — dispatches to versioned resolvers via ProfileHandler.
 */

import type { NoteRepository } from '@cqrs-toolkit/demo-base/notes/server'
import { Hypermedia, ProfileHandler } from '@cqrs-toolkit/hypermedia/server'
import type { FastifyReply } from 'fastify'
import { handleProfileHandler } from '../../query-utils.js'
import { GetNoteByIdV1_0_0 } from './v1_0_0/GetNoteById.js'
import { NoteRepV1_0_0 } from './v1_0_0/representation.js'

interface Request extends Hypermedia.Request {
  params: { id: string }
}

export namespace GetNoteById {
  const profileHandler = new ProfileHandler<true, NoteRepository, void, Request>({
    representations: [
      {
        version: NoteRepV1_0_0.version,
        urn: NoteRepV1_0_0.resource.profile,
        resolve: (request, reply, noteRepo) => {
          return GetNoteByIdV1_0_0.resolve(request, reply, noteRepo)
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
  export const schema = GetNoteByIdV1_0_0.schema

  export function resolve(
    request: Request,
    reply: FastifyReply,
    noteRepo: NoteRepository,
  ): Promise<void> {
    return handleProfileHandler(reply, profileHandler.resolve(request, reply, noteRepo, undefined))
  }
}
