/**
 * FileObject command handlers — anticipated event production.
 */

import { createEntityId, domainSuccess } from '@cqrs-toolkit/client'
import type { AppCommandHandlerRegistration } from '../utils/executors.js'

export const fileObjectHandlers: AppCommandHandlerRegistration[] = [
  {
    commandType: 'storage.CreateFileObject',
    creates: { eventType: 'FileObjectCreated', idStrategy: 'temporary' },
    parentRef: [{ field: 'noteId', fromCommand: 'nb.CreateNote' }],
    handler(command, context) {
      const { noteId } = command.data as { noteId: string }
      const id = createEntityId(context)
      const now = new Date().toISOString()
      return domainSuccess([
        {
          type: 'FileObjectCreated',
          data: {
            id,
            noteId,
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
    handler(command) {
      const { id } = command.path
      return domainSuccess([
        { type: 'FileObjectDeleted', data: { id }, streamId: `FileObject-${id}` },
      ])
    },
  },
]
