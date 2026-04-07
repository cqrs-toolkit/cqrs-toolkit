/**
 * Note resource resolver — v1.0.0.
 */

import type { NoteRepository } from '@cqrs-toolkit/demo-base/notes/server'
import type { HypermediaTypes } from '@cqrs-toolkit/hypermedia'
import {
  Hypermedia,
  NotFoundException,
  type RepliedValue,
  type ResolvedValue,
} from '@cqrs-toolkit/hypermedia/server'
import { Err, Ok, type Result } from '@meticoeus/ddd-es'
import type { FastifyReply } from 'fastify'
import { HalNote, NoteClass } from '../doc.js'

interface GetByIdRequest extends Hypermedia.Request {
  params: { id: string }
}

export namespace GetNoteByIdV1_0_0 {
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
    halDefs: [HalNote],
  }

  export async function resolve(
    request: GetByIdRequest,
    _reply: FastifyReply,
    noteRepo: NoteRepository,
  ): Promise<Result<ResolvedValue | RepliedValue>> {
    const note = noteRepo.findById(request.params.id)
    if (!note) return Err(new NotFoundException())

    const rd: HypermediaTypes.ResourceDescriptor = {
      class: NoteClass,
      properties: note,
    }

    return Ok({ kind: 'resolved', ...Hypermedia.formatResource(request, rd, formatConfig) })
  }
}
