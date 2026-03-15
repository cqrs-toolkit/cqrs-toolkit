/**
 * Todo command handlers — client-side validation and anticipated event production.
 */

import {
  domainFailure,
  domainSuccess,
  generateId,
  isAutoRevision,
  type CommandHandlerRegistration,
  type ValidationError,
} from '@cqrs-toolkit/client'
import type { TodoStatus } from '../../shared/todos/types.js'

interface AnticipatedEvent {
  type: string
  data: Record<string, unknown>
  streamId: string
}

const VALID_STATUSES: readonly TodoStatus[] = ['pending', 'in_progress', 'completed']

const mutateConfig = { revisionField: 'revision' as const }

export const todoHandlers: CommandHandlerRegistration<AnticipatedEvent>[] = [
  {
    commandType: 'CreateTodo',
    creates: { eventType: 'TodoCreated', idStrategy: 'temporary' },
    handler(payload) {
      const errors = requireNonEmpty(payload, 'content')
      if (errors.length > 0) return domainFailure(errors)
      const { content } = payload as { content: string }
      const id = generateId()
      const now = new Date().toISOString()
      return domainSuccess([
        {
          type: 'TodoCreated',
          data: { id, content, status: 'pending', createdAt: now },
          streamId: `Todo-${id}`,
        },
      ])
    },
  },
  {
    ...mutateConfig,
    commandType: 'UpdateTodoContent',
    handler(payload) {
      const errors = requireNonEmpty(payload, 'id', 'content')
      if (errors.length > 0) return domainFailure(errors)
      const { id, content } = payload as { id: string; content: string }
      return domainSuccess([
        {
          type: 'TodoContentUpdated',
          data: { id, content, updatedAt: new Date().toISOString() },
          streamId: `Todo-${id}`,
        },
      ])
    },
  },
  {
    ...mutateConfig,
    commandType: 'ChangeTodoStatus',
    handler(payload) {
      const errors = requireNonEmpty(payload, 'id')
      if (
        !isObject(payload) ||
        !VALID_STATUSES.includes((payload as { status: TodoStatus }).status)
      ) {
        errors.push({ path: 'status', message: 'Invalid status value' })
      }
      if (errors.length > 0) return domainFailure(errors)
      const { id, status } = payload as { id: string; status: TodoStatus }
      return domainSuccess([
        {
          type: 'TodoStatusChanged',
          data: { id, status, updatedAt: new Date().toISOString() },
          streamId: `Todo-${id}`,
        },
      ])
    },
  },
  {
    ...mutateConfig,
    commandType: 'DeleteTodo',
    handler(payload) {
      const errors = requireNonEmpty(payload, 'id')
      if (errors.length > 0) return domainFailure(errors)
      const { id } = payload as { id: string }
      return domainSuccess([{ type: 'TodoDeleted', data: { id }, streamId: `Todo-${id}` }])
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
