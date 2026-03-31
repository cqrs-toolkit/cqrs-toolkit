/**
 * FileObject resource resolver — v1.0.0.
 */

import type { FileObjectRepository } from '@cqrs-toolkit/demo-base/file-objects/server'
import type { HypermediaTypes } from '@cqrs-toolkit/hypermedia'
import {
  Hypermedia,
  NotFoundException,
  type RepliedValue,
  type ResolvedValue,
} from '@cqrs-toolkit/hypermedia/server'
import { Err, Ok, type Result } from '@meticoeus/ddd-es'
import type { FastifyReply } from 'fastify'
import { FileObjectClass, HalFileObject } from '../doc.js'

interface GetByIdRequest extends Hypermedia.Request {
  params: { id: string }
}

export namespace GetFileObjectByIdV1_0_0 {
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
    halDefs: [HalFileObject],
  }

  export async function resolve(
    request: GetByIdRequest,
    _reply: FastifyReply,
    fileObjectRepo: FileObjectRepository,
  ): Promise<Result<ResolvedValue | RepliedValue>> {
    const fileObject = fileObjectRepo.findById(request.params.id)
    if (!fileObject) return Err(new NotFoundException())

    const rd: HypermediaTypes.ResourceDescriptor = {
      class: FileObjectClass,
      properties: fileObject,
    }

    return Ok({ kind: 'resolved', ...Hypermedia.formatResource(request, rd, formatConfig) })
  }
}
