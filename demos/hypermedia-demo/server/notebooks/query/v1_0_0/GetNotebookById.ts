/**
 * Notebook resource resolver — v1.0.0.
 */

import type { NotebookRepository } from '@cqrs-toolkit/demo-base/notebooks/server'
import type { HypermediaTypes } from '@cqrs-toolkit/hypermedia'
import {
  Hypermedia,
  NotFoundException,
  type RepliedValue,
  type ResolvedValue,
} from '@cqrs-toolkit/hypermedia/server'
import { Err, Ok, type Result } from '@meticoeus/ddd-es'
import type { FastifyReply } from 'fastify'
import { HalNotebook, NotebookClass } from '../doc.js'

interface GetByIdRequest extends Hypermedia.Request {
  params: { id: string }
}

export namespace GetNotebookByIdV1_0_0 {
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
    halDefs: [HalNotebook],
  }

  export async function resolve(
    request: GetByIdRequest,
    _reply: FastifyReply,
    notebookRepo: NotebookRepository,
  ): Promise<Result<ResolvedValue | RepliedValue>> {
    const notebook = notebookRepo.findById(request.params.id)
    if (!notebook) return Err(new NotFoundException())

    const rd: HypermediaTypes.ResourceDescriptor = {
      class: NotebookClass,
      properties: notebook,
    }

    return Ok({ kind: 'resolved', ...Hypermedia.formatResource(request, rd, formatConfig) })
  }
}
