/**
 * Note command handlers — anticipated event production from validated data.
 */

import { createEntityId, domainSuccess } from '@cqrs-toolkit/client'
import { NoteAggregate } from '@cqrs-toolkit/demo-base/notes/domain'
import {
  createNotePayloadSchema,
  deleteNotePayloadSchema,
  updateNoteBodyPayloadSchema,
  updateNoteTitlePayloadSchema,
} from '@cqrs-toolkit/demo-base/notes/shared'
import type { AppCommandHandlerRegistration } from '../utils/executors.js'

export const noteHandlers: AppCommandHandlerRegistration[] = [
  {
    commandType: 'CreateNote',
    schema: createNotePayloadSchema,
    creates: { eventType: 'NoteCreated', idStrategy: 'temporary' },
    parentRef: [{ field: 'notebookId', fromCommand: 'CreateNotebook' }],
    handler(command, _state, context) {
      const { notebookId, title, body } = command.data as {
        notebookId: string
        title: string
        body: string
      }
      const id = createEntityId(context)
      const now = new Date().toISOString()
      return domainSuccess([
        {
          type: 'NoteCreated',
          data: { id, notebookId, title, body, createdAt: now },
          streamId: NoteAggregate.getStreamId(id),
        },
      ])
    },
  },
  {
    commandType: 'UpdateNoteTitle',
    schema: updateNoteTitlePayloadSchema,
    handler(command) {
      const { id, title } = command.data as { id: string; title: string }
      return domainSuccess([
        {
          type: 'NoteTitleUpdated',
          data: { id, title, updatedAt: new Date().toISOString() },
          streamId: NoteAggregate.getStreamId(id),
        },
      ])
    },
  },
  {
    commandType: 'UpdateNoteBody',
    schema: updateNoteBodyPayloadSchema,
    handler(command) {
      const { id, body } = command.data as { id: string; body: string }
      return domainSuccess([
        {
          type: 'NoteBodyUpdated',
          data: { id, body, updatedAt: new Date().toISOString() },
          streamId: NoteAggregate.getStreamId(id),
        },
      ])
    },
  },
  {
    commandType: 'DeleteNote',
    schema: deleteNotePayloadSchema,
    handler(command) {
      const { id } = command.data as { id: string }
      return domainSuccess([
        {
          type: 'NoteDeleted',
          data: { id },
          streamId: NoteAggregate.getStreamId(id),
        },
      ])
    },
  },
]
