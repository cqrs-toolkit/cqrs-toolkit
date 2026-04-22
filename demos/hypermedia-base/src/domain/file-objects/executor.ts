/**
 * FileObject command handlers — anticipated event production.
 */

import { createEntityId, domainSuccess } from '@cqrs-toolkit/client'
import { assert } from '@cqrs-toolkit/client/utils'
import { FileObjectAggregate } from '@cqrs-toolkit/demo-base/file-objects/domain'
import { NoteAggregate } from '@cqrs-toolkit/demo-base/notes/domain'
import type { AppCommandHandlerRegistration } from '../utils/executors.js'

export const fileObjectHandlers: AppCommandHandlerRegistration[] = [
  {
    commandType: 'storage.CreateFileObject',
    aggregate: FileObjectAggregate,
    commandIdReferences: [{ aggregate: NoteAggregate, path: '$.data.noteId' }],
    creates: { eventType: 'FileObjectCreated', idStrategy: 'temporary' },
    handler(command, _state, context) {
      const { noteId } = command.data as { noteId: string }
      const file = command.fileRefs?.[0]
      assert(file, 'CreateFileObject requires a file attachment')
      const id = createEntityId(context)
      const now = new Date().toISOString()
      return domainSuccess([
        {
          type: 'FileObjectCreated',
          data: {
            id,
            noteId,
            name: file.filename,
            contentType: file.mimeType,
            resource: '',
            size: file.sizeBytes,
            createdAt: now,
          },
          streamId: FileObjectAggregate.getStreamId(id),
        },
      ])
    },
  },
  {
    commandType: 'storage.DeleteFileObject',
    aggregate: FileObjectAggregate,
    commandIdReferences: [{ aggregate: FileObjectAggregate, path: '$.path.id' }],
    handler(command) {
      // TODO(command-types): Figure out how we can fix this
      const { id } = command.path as { id: string }
      return domainSuccess([
        { type: 'FileObjectDeleted', data: { id }, streamId: FileObjectAggregate.getStreamId(id) },
      ])
    },
  },
]
