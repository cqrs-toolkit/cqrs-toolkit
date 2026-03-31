/**
 * FileObject collection query — dispatches to versioned resolvers via ProfileHandler.
 */

import type { FileObjectRepository } from '@cqrs-toolkit/demo-base/file-objects/server'
import { Hypermedia, ProfileHandler } from '@cqrs-toolkit/hypermedia/server'
import type { FastifyReply } from 'fastify'
import { handleProfileHandler } from '../../query-utils.js'
import { GetFileObjectsV1_0_0 } from './v1_0_0/GetFileObjects.js'
import { FileObjectRepV1_0_0 } from './v1_0_0/representation.js'

export namespace GetFileObjects {
  const profileHandler = new ProfileHandler<true, FileObjectRepository, void>({
    representations: [
      {
        version: FileObjectRepV1_0_0.version,
        urn: FileObjectRepV1_0_0.collection.profile,
        resolve: (request, reply, fileObjectRepo) => {
          return GetFileObjectsV1_0_0.resolve(request, reply, fileObjectRepo)
        },
      },
    ],
  })

  export const schema = GetFileObjectsV1_0_0.schema

  export function resolve(
    request: Hypermedia.Request,
    reply: FastifyReply,
    fileObjectRepo: FileObjectRepository,
  ): Promise<void> {
    return handleProfileHandler(
      reply,
      profileHandler.resolve(request, reply, fileObjectRepo, undefined),
    )
  }
}
