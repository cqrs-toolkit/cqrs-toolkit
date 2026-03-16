/**
 * Todo command handlers — client-side validation and anticipated event production.
 */

import {
  domainFailure,
  domainSuccess,
  generateId,
  type CommandHandlerRegistration,
} from '@cqrs-toolkit/client'
import type { TodoStatus } from '../../shared/todos/types.js'
import { MUTATE_CONFIG, isObject, requireNonEmpty } from '../domain-utils/executors.js'

interface AnticipatedEvent {
  type: string
  data: Record<string, unknown>
  streamId: string
}

const VALID_STATUSES: readonly TodoStatus[] = ['pending', 'in_progress', 'completed']

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
    ...MUTATE_CONFIG,
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
    ...MUTATE_CONFIG,
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
    ...MUTATE_CONFIG,
    commandType: 'DeleteTodo',
    handler(payload) {
      const errors = requireNonEmpty(payload, 'id')
      if (errors.length > 0) return domainFailure(errors)
      const { id } = payload as { id: string }
      return domainSuccess([{ type: 'TodoDeleted', data: { id }, streamId: `Todo-${id}` }])
    },
  },
]
