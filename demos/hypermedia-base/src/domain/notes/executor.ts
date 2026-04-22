/**
 * Note command handlers — anticipated event production from validated data.
 */

import { createEntityId, domainSuccess } from '@cqrs-toolkit/client'
import { NotebookAggregate } from '@cqrs-toolkit/demo-base/notebooks/domain'
import { NoteAggregate } from '@cqrs-toolkit/demo-base/notes/domain'
import type { AppCommandHandlerRegistration } from '../utils/executors.js'

export const noteHandlers: AppCommandHandlerRegistration[] = [
  {
    commandType: 'nb.CreateNote',
    aggregate: NoteAggregate,
    commandIdReferences: [{ aggregate: NotebookAggregate, path: '$.data.notebookId' }],
    creates: { eventType: 'NoteCreated', idStrategy: 'temporary' },
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
          data: {
            id,
            notebookId,
            title,
            body,
            createdAt: now,
          },
          streamId: NoteAggregate.getStreamId(id),
        },
      ])
    },
  },
  {
    commandType: 'nb.UpdateNoteTitle',
    aggregate: NoteAggregate,
    commandIdReferences: [{ aggregate: NoteAggregate, path: '$.path.id' }],
    handler(command) {
      const { title } = command.data as { title: string }
      // TODO(command-types): Figure out how we can fix this
      const { id } = command.path as { id: string }
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
    commandType: 'nb.UpdateNoteBody',
    aggregate: NoteAggregate,
    commandIdReferences: [{ aggregate: NoteAggregate, path: '$.path.id' }],
    handler(command) {
      const { body } = command.data as { body: string }
      // TODO(command-types): Figure out how we can fix this
      const { id } = command.path as { id: string }
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
    commandType: 'nb.DeleteNote',
    aggregate: NoteAggregate,
    commandIdReferences: [{ aggregate: NoteAggregate, path: '$.path.id' }],
    handler(command) {
      // TODO(command-types): Figure out how we can fix this
      const { id } = command.path as { id: string }
      return domainSuccess([
        { type: 'NoteDeleted', data: { id }, streamId: NoteAggregate.getStreamId(id) },
      ])
    },
  },
]
