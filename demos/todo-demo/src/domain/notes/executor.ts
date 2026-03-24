/**
 * Note command handlers — anticipated event production from validated data.
 */

import { createEntityId, domainSuccess, type HandlerContext } from '@cqrs-toolkit/client'
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
    commandType: 'UpdateNoteTitle',
    schema: updateNoteTitlePayloadSchema,
    handler(data: { id: string; title: string }) {
      return domainSuccess([
        {
          type: 'NoteTitleUpdated',
          data: { id: data.id, title: data.title, updatedAt: new Date().toISOString() },
          streamId: `Note-${data.id}`,
        },
      ])
    },
  },
  {
    commandType: 'UpdateNoteBody',
    schema: updateNoteBodyPayloadSchema,
    handler(data: { id: string; body: string }) {
      return domainSuccess([
        {
          type: 'NoteBodyUpdated',
          data: { id: data.id, body: data.body, updatedAt: new Date().toISOString() },
          streamId: `Note-${data.id}`,
        },
      ])
    },
  },
  {
    commandType: 'DeleteNote',
    schema: deleteNotePayloadSchema,
    handler(data: { id: string }) {
      return domainSuccess([
        { type: 'NoteDeleted', data: { id: data.id }, streamId: `Note-${data.id}` },
      ])
    },
  },
]
