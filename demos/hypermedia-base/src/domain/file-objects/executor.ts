/**
 * FileObject command handlers — anticipated event production.
 */

import { createEntityId, domainSuccess } from '@cqrs-toolkit/client'
import { FileObjectAggregate } from '@cqrs-toolkit/demo-base/file-objects/domain'
import type { AppCommandHandlerRegistration } from '../utils/executors.js'

export const fileObjectHandlers: AppCommandHandlerRegistration[] = [
  {
    commandType: 'storage.CreateFileObject',
    creates: { eventType: 'FileObjectCreated', idStrategy: 'temporary' },
    parentRef: [{ field: 'noteId', fromCommand: 'nb.CreateNote' }],
    handler(command, _state, context) {
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
          streamId: FileObjectAggregate.getStreamId(id),
        },
      ])
    },
  },
  {
    commandType: 'storage.DeleteFileObject',
    handler(command) {
      // TODO(command-types): Figure out how we can fix this
      const { id } = command.path as { id: string }
      return domainSuccess([
        { type: 'FileObjectDeleted', data: { id }, streamId: FileObjectAggregate.getStreamId(id) },
      ])
    },
  },
]
