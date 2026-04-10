/**
 * Notebook collection resolver — v1.0.0.
 */

import type { Notebook, NotebookRepository } from '@cqrs-toolkit/demo-base/notebooks/server'
import type { CursorPagination, HypermediaTypes } from '@cqrs-toolkit/hypermedia'
import { Hypermedia, type RepliedValue, type ResolvedValue } from '@cqrs-toolkit/hypermedia/server'
import { Ok, type Result } from '@meticoeus/ddd-es'
import type { FastifyReply } from 'fastify'
import { HalNotebook, HalNotebookCollection, NotebookClass } from '../doc.js'
import { NotebookRepV1_0_0 } from './representation.js'

export namespace GetNotebooksV1_0_0 {
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
    halDefs: [HalNotebook],
    collectionDef: HalNotebookCollection,
    linkDensity: 'lean',
  }

  export async function resolve(
    request: Hypermedia.Request,
    _reply: FastifyReply,
    notebookRepo: NotebookRepository,
  ): Promise<Result<ResolvedValue | RepliedValue>> {
    const queryParams = request.query
    const limit = parseInt((queryParams?.['limit'] as string) ?? '50', 10)
    const cursor = queryParams?.['cursor'] as string | undefined

    const result = notebookRepo.list(cursor, limit)

    const connection: CursorPagination.Connection<Notebook> = {
      entities: result.items,
      nextCursor: result.nextCursor,
    }

    const page = Hypermedia.pageViewFromCursor(connection, {
      path: NotebookRepV1_0_0.collectionHref,
      query: queryParams,
    })

    const cd = Hypermedia.buildCollectionDescriptor<Notebook>({
      connection,
      page,
      buildMember: (data): HypermediaTypes.ResourceDescriptor => ({
        class: NotebookClass,
        properties: data,
      }),
    })

    return Ok({ kind: 'resolved', ...Hypermedia.formatCollection(request, cd, formatConfig) })
  }
}
