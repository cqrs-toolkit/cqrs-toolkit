/**
 * FileObject command handlers — anticipated event production.
 */

import { createEntityId, domainSuccess, type HandlerContext } from '@cqrs-toolkit/client'
import {
  createFileObjectPayloadSchema,
  deleteFileObjectPayloadSchema,
} from '../../../server/file-objects/commands.js'
import type { AppCommandHandlerRegistration } from '../utils/executors.js'

export const fileObjectHandlers: AppCommandHandlerRegistration[] = [
  {
    commandType: 'CreateFileObject',
    schema: createFileObjectPayloadSchema,
    creates: { eventType: 'FileObjectCreated', idStrategy: 'temporary' },
    parentRef: [{ field: 'noteId', fromCommand: 'CreateNote' }],
    handler(data: { noteId: string }, context: HandlerContext) {
      const id = createEntityId(context)
      const now = new Date().toISOString()
      return domainSuccess([
        {
          type: 'FileObjectCreated',
          data: {
            id,
            noteId: data.noteId,
            name: '',
            contentType: '',
            resource: '',
            size: 0,
            createdAt: now,
          },
          streamId: `FileObject-${id}`,
        },
      ])
    },
  },
  {
    commandType: 'DeleteFileObject',
    schema: deleteFileObjectPayloadSchema,
    handler(data: { id: string }) {
      return domainSuccess([
        { type: 'FileObjectDeleted', data: { id: data.id }, streamId: `FileObject-${data.id}` },
      ])
    },
  },
]
