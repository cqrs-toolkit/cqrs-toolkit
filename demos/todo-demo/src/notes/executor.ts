/**
 * Note command handlers — client-side validation and anticipated event production.
 */

import {
  domainFailure,
  domainSuccess,
  generateId,
  isAutoRevision,
  type CommandHandlerRegistration,
  type ValidationError,
} from '@cqrs-toolkit/client'

interface AnticipatedEvent {
  type: string
  data: Record<string, unknown>
  streamId: string
}

const mutateConfig = { revisionField: 'revision' as const }

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
    ...mutateConfig,
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
    ...mutateConfig,
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
    ...mutateConfig,
    commandType: 'DeleteNote',
    handler(payload) {
      const errors = requireNonEmpty(payload, 'id')
      if (errors.length > 0) return domainFailure(errors)
      const { id } = payload as { id: string }
      return domainSuccess([{ type: 'NoteDeleted', data: { id }, streamId: `Note-${id}` }])
    },
  },
]

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function requireNonEmpty(payload: unknown, ...fields: string[]): ValidationError[] {
  if (!isObject(payload)) return [{ path: '', message: 'Invalid payload' }]
  const errors: ValidationError[] = []
  for (const field of fields) {
    const value = payload[field]
    // Skip AUTO_REVISION markers — the library resolves these before send
    if (isAutoRevision(value)) continue
    if (typeof value !== 'string' || value.length === 0) {
      errors.push({ path: field, message: `${field} must not be empty` })
    }
  }
  return errors
}
