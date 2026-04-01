/**
 * FileObject command handlers — anticipated event production.
 */

import { createEntityId, domainSuccess, type HandlerContext } from '@cqrs-toolkit/client'
import type { AppCommandHandlerRegistration } from '../utils/executors.js'

export const fileObjectHandlers: AppCommandHandlerRegistration[] = [
  {
    commandType: 'storage.CreateFileObject',
    creates: { eventType: 'FileObjectCreated', idStrategy: 'temporary' },
    parentRef: [{ field: 'noteId', fromCommand: 'nb.CreateNote' }],
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
    commandType: 'storage.DeleteFileObject',
    handler(_data: unknown, context: HandlerContext) {
      const { id } = context.path as { id: string }
      return domainSuccess([
        { type: 'FileObjectDeleted', data: { id }, streamId: `FileObject-${id}` },
      ])
    },
  },
]
