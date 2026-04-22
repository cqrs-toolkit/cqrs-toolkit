/**
 * FileObject command handlers — anticipated event production.
 */

import { createEntityId, domainSuccess } from '@cqrs-toolkit/client'
import { assert } from '@cqrs-toolkit/client/utils'
import { FileObjectAggregate } from '@cqrs-toolkit/demo-base/file-objects/domain'
import { NoteAggregate } from '@cqrs-toolkit/demo-base/notes/domain'
import { logProvider } from '@meticoeus/ddd-es'
import {
  createFileObjectPayloadSchema,
  deleteFileObjectPayloadSchema,
} from '../../../server/file-objects/commands.js'
import type { AppCommandHandlerRegistration } from '../utils/executors.js'

export const fileObjectHandlers: AppCommandHandlerRegistration[] = [
  {
    commandType: 'CreateFileObject',
    aggregate: FileObjectAggregate,
    commandIdReferences: [{ aggregate: NoteAggregate, path: '$.data.noteId' }],
    schema: createFileObjectPayloadSchema,
    creates: { eventType: 'FileObjectCreated', idStrategy: 'temporary' },
    handler(command, _state, context) {
      const { noteId } = command.data as { noteId: string }
      const file = command.fileRefs?.[0]
      logProvider.log.debug(
        { fileRefs: command.fileRefs },
        'CreateFileObject handler received fileRefs',
      )
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
    commandType: 'DeleteFileObject',
    aggregate: FileObjectAggregate,
    commandIdReferences: [{ aggregate: FileObjectAggregate, path: '$.data.id' }],
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
