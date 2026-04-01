/**
 * Note command handlers — anticipated event production from validated data.
 */

import { createEntityId, domainSuccess, type HandlerContext } from '@cqrs-toolkit/client'
import type { AppCommandHandlerRegistration } from '../utils/executors.js'

export const noteHandlers: AppCommandHandlerRegistration[] = [
  {
    commandType: 'nb.CreateNote',
    creates: { eventType: 'NoteCreated', idStrategy: 'temporary' },
    parentRef: [{ field: 'notebookId', fromCommand: 'CreateNotebook' }],
    handler(data: { notebookId: string; title: string; body: string }, context: HandlerContext) {
      const id = createEntityId(context)
      const now = new Date().toISOString()
      return domainSuccess([
        {
          type: 'NoteCreated',
          data: {
            id,
            notebookId: data.notebookId,
            title: data.title,
            body: data.body,
            createdAt: now,
          },
          streamId: `Note-${id}`,
        },
      ])
    },
  },
  {
    commandType: 'nb.UpdateNoteTitle',
    handler(data: { title: string }, context: HandlerContext) {
      const { id } = context.path as { id: string }
      return domainSuccess([
        {
          type: 'NoteTitleUpdated',
          data: { id, title: data.title, updatedAt: new Date().toISOString() },
          streamId: `Note-${id}`,
        },
      ])
    },
  },
  {
    commandType: 'nb.UpdateNoteBody',
    handler(data: { body: string }, context: HandlerContext) {
      const { id } = context.path as { id: string }
      return domainSuccess([
        {
          type: 'NoteBodyUpdated',
          data: { id, body: data.body, updatedAt: new Date().toISOString() },
          streamId: `Note-${id}`,
        },
      ])
    },
  },
  {
    commandType: 'nb.DeleteNote',
    handler(_data: unknown, context: HandlerContext) {
      const { id } = context.path as { id: string }
      return domainSuccess([{ type: 'NoteDeleted', data: { id }, streamId: `Note-${id}` }])
    },
  },
]
