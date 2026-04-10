/**
 * FileObject command handlers — anticipated event production.
 */

import { createEntityId, domainSuccess } from '@cqrs-toolkit/client'
import { FileObjectAggregate } from '@cqrs-toolkit/demo-base/file-objects/domain'
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
    commandType: 'DeleteFileObject',
    schema: deleteFileObjectPayloadSchema,
    handler(command) {
      const { id } = command.data as { id: string }
      return domainSuccess([
        {
          type: 'FileObjectDeleted',
          data: { id },
          streamId: FileObjectAggregate.getStreamId(id),
        },
      ])
    },
  },
]
