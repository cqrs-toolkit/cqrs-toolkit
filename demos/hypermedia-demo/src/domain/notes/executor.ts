/**
 * Note command handlers — anticipated event production from validated data.
 */

import { createEntityId, domainSuccess } from '@cqrs-toolkit/client'
import type { AppCommandHandlerRegistration } from '../utils/executors.js'

export const noteHandlers: AppCommandHandlerRegistration[] = [
  {
    commandType: 'nb.CreateNote',
    creates: { eventType: 'NoteCreated', idStrategy: 'temporary' },
    parentRef: [{ field: 'notebookId', fromCommand: 'CreateNotebook' }],
    handler(command, context) {
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
          streamId: `Note-${id}`,
        },
      ])
    },
  },
  {
    commandType: 'nb.UpdateNoteTitle',
    handler(command) {
      const { title } = command.data as { title: string }
      const { id } = command.path
      return domainSuccess([
        {
          type: 'NoteTitleUpdated',
          data: { id, title, updatedAt: new Date().toISOString() },
          streamId: `Note-${id}`,
        },
      ])
    },
  },
  {
    commandType: 'nb.UpdateNoteBody',
    handler(command) {
      const { body } = command.data as { body: string }
      const { id } = command.path
      return domainSuccess([
        {
          type: 'NoteBodyUpdated',
          data: { id, body, updatedAt: new Date().toISOString() },
          streamId: `Note-${id}`,
        },
      ])
    },
  },
  {
    commandType: 'nb.DeleteNote',
    handler(command) {
      const { id } = command.path
      return domainSuccess([{ type: 'NoteDeleted', data: { id }, streamId: `Note-${id}` }])
    },
  },
]
