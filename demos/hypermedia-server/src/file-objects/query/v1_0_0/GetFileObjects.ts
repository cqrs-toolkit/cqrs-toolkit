/**
 * FileObject collection resolver — v1.0.0.
 */

import type { FileObjectRepository } from '@cqrs-toolkit/demo-base/file-objects/server'
import type { FileObject } from '@cqrs-toolkit/demo-base/file-objects/shared'
import type { CursorPagination, HypermediaTypes } from '@cqrs-toolkit/hypermedia'
import { Hypermedia, type RepliedValue, type ResolvedValue } from '@cqrs-toolkit/hypermedia/server'
import { Ok, type Result } from '@meticoeus/ddd-es'
import type { FastifyReply } from 'fastify'
import { FileObjectClass, HalFileObject, HalFileObjectCollection } from '../doc.js'
import { FileObjectRepV1_0_0 } from './representation.js'

export namespace GetFileObjectsV1_0_0 {
  export const schema = {
    querystring: {
      type: 'object',
      properties: {
        cursor: { type: 'string' },
        limit: { type: 'string' },
        noteId: { type: 'string' },
      },
      additionalProperties: false,
    },
  }

  const formatConfig: Hypermedia.CollectionFormatConfig = {
    halDefs: [HalFileObject],
    collectionDef: HalFileObjectCollection,
    linkDensity: 'lean',
  }

  export async function resolve(
    request: Hypermedia.Request,
    _reply: FastifyReply,
    fileObjectRepo: FileObjectRepository,
  ): Promise<Result<ResolvedValue | RepliedValue>> {
    const queryParams = request.query
    const limit = parseInt((queryParams?.['limit'] as string) ?? '50', 10)
    const cursor = queryParams?.['cursor'] as string | undefined
    const noteId = queryParams?.['noteId'] as string | undefined

    const result = noteId
      ? fileObjectRepo.listByNote(noteId, cursor, limit)
      : fileObjectRepo.list(cursor, limit)

    const connection: CursorPagination.Connection<FileObject> = {
      entities: result.items,
      nextCursor: result.nextCursor,
    }

    const page = Hypermedia.pageViewFromCursor(connection, {
      path: FileObjectRepV1_0_0.collectionHref,
      query: queryParams,
    })

    const cd = Hypermedia.buildCollectionDescriptor<FileObject>({
      connection,
      page,
      buildMember: (data): HypermediaTypes.ResourceDescriptor => ({
        class: FileObjectClass,
        properties: data,
      }),
    })

    return Ok({ kind: 'resolved', ...Hypermedia.formatCollection(request, cd, formatConfig) })
  }
}
