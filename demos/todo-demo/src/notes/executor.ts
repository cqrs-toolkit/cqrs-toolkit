/**
 * Note command handlers — client-side validation and anticipated event production.
 */

import {
  domainFailure,
  domainSuccess,
  generateId,
  type CommandHandlerRegistration,
} from '@cqrs-toolkit/client'
import { MUTATE_CONFIG, requireNonEmpty } from '../domain-utils/executors.js'

interface AnticipatedEvent {
  type: string
  data: Record<string, unknown>
  streamId: string
}

export const noteHandlers: CommandHandlerRegistration<AnticipatedEvent>[] = [
  {
    commandType: 'CreateNote',
    creates: { eventType: 'NoteCreated', idStrategy: 'temporary' },
    handler(payload) {
      const errors = requireNonEmpty(payload, 'title')
      if (errors.length > 0) return domainFailure(errors)
      const { title, body } = payload as { title: string; body: string }
      const id = generateId()
      const now = new Date().toISOString()
      return domainSuccess([
        {
          type: 'NoteCreated',
          data: { id, title, body, createdAt: now },
          streamId: `Note-${id}`,
        },
      ])
    },
  },
  {
    ...MUTATE_CONFIG,
    commandType: 'UpdateNoteTitle',
    handler(payload) {
      const errors = requireNonEmpty(payload, 'id', 'title')
      if (errors.length > 0) return domainFailure(errors)
      const { id, title } = payload as { id: string; title: string }
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
    ...MUTATE_CONFIG,
    commandType: 'UpdateNoteBody',
    handler(payload) {
      const errors = requireNonEmpty(payload, 'id')
      if (errors.length > 0) return domainFailure(errors)
      const { id, body } = payload as { id: string; body: string }
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
    ...MUTATE_CONFIG,
    commandType: 'DeleteNote',
    handler(payload) {
      const errors = requireNonEmpty(payload, 'id')
      if (errors.length > 0) return domainFailure(errors)
      const { id } = payload as { id: string }
      return domainSuccess([{ type: 'NoteDeleted', data: { id }, streamId: `Note-${id}` }])
    },
  },
]
