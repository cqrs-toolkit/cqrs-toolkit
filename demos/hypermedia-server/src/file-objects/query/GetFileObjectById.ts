/**
 * FileObject resource query — dispatches to versioned resolvers via ProfileHandler.
 */

import type { FileObjectRepository } from '@cqrs-toolkit/demo-base/file-objects/server'
import { Hypermedia, ProfileHandler } from '@cqrs-toolkit/hypermedia/server'
import type { FastifyReply } from 'fastify'
import { handleProfileHandler } from '../../query-utils.js'
import { GetFileObjectByIdV1_0_0 } from './v1_0_0/GetFileObjectById.js'
import { FileObjectRepV1_0_0 } from './v1_0_0/representation.js'

interface Request extends Hypermedia.Request {
  params: { id: string }
}

export namespace GetFileObjectById {
  const profileHandler = new ProfileHandler<true, FileObjectRepository, void, Request>({
    representations: [
      {
        version: FileObjectRepV1_0_0.version,
        urn: FileObjectRepV1_0_0.resource.profile,
        resolve: (request, reply, fileObjectRepo) => {
          return GetFileObjectByIdV1_0_0.resolve(request, reply, fileObjectRepo)
        },
      },
    ],
  })

  export const schema = GetFileObjectByIdV1_0_0.schema

  export function resolve(
    request: Request,
    reply: FastifyReply,
    fileObjectRepo: FileObjectRepository,
  ): Promise<void> {
    return handleProfileHandler(
      reply,
      profileHandler.resolve(request, reply, fileObjectRepo, undefined),
    )
  }
}
