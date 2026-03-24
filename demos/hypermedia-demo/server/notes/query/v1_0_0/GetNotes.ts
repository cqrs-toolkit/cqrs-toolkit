/**
 * Note collection resolver — v1.0.0.
 */

import type { NoteRepository } from '@cqrs-toolkit/demo-base/notes/server'
import type { Note } from '@cqrs-toolkit/demo-base/notes/shared'
import type { CursorPagination, HypermediaTypes } from '@cqrs-toolkit/hypermedia'
import { Hypermedia, type RepliedValue, type ResolvedValue } from '@cqrs-toolkit/hypermedia/server'
import { Ok, type Result } from '@meticoeus/ddd-es'
import type { FastifyReply } from 'fastify'
import { HalNote, HalNoteCollection, NoteClass } from '../doc.js'
import { NoteRepV1_0_0 } from './representation.js'

export namespace GetNotesV1_0_0 {
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
    halDefs: [HalNote],
    collectionDef: HalNoteCollection,
    linkDensity: 'lean',
  }

  export async function resolve(
    request: Hypermedia.Request,
    _reply: FastifyReply,
    noteRepo: NoteRepository,
  ): Promise<Result<ResolvedValue | RepliedValue>> {
    const queryParams = request.query
    const limit = parseInt((queryParams?.['limit'] as string) ?? '50', 10)
    const cursor = queryParams?.['cursor'] as string | undefined

    const result = noteRepo.list(cursor, limit)

    const connection: CursorPagination.Connection<Note> = {
      entities: result.items,
      nextCursor: result.nextCursor,
    }

    const page = Hypermedia.pageViewFromCursor(connection, {
      path: NoteRepV1_0_0.collectionHref,
      query: queryParams,
    })

    const cd = Hypermedia.buildCollectionDescriptor<Note>({
      connection,
      page,
      buildMember: (data): HypermediaTypes.ResourceDescriptor => ({
        class: NoteClass,
        properties: data,
      }),
    })

    return Ok({ kind: 'resolved', ...Hypermedia.formatCollection(request, cd, formatConfig) })
  }
}
