/**
 * FileObject command handlers — anticipated event production.
 */

import { createEntityId, domainSuccess } from '@cqrs-toolkit/client'
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
    commandType: 'DeleteFileObject',
    schema: deleteFileObjectPayloadSchema,
    handler(command) {
      const { id } = command.data as { id: string }
      return domainSuccess([
        {
          type: 'FileObjectDeleted',
          data: { id },
          streamId: `FileObject-${id}`,
        },
      ])
    },
  },
]
