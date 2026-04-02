/**
 * Todo command handlers — anticipated event production from validated data.
 */

import { createEntityId, domainSuccess } from '@cqrs-toolkit/client'
import type { AppCommandHandlerRegistration } from '../utils/executors.js'

export const todoHandlers: AppCommandHandlerRegistration[] = [
  {
    commandType: 'nb.CreateTodo',
    creates: { eventType: 'TodoCreated', idStrategy: 'temporary' },
    handler(command, context) {
      const { content } = command.data as { content: string }
      const id = createEntityId(context)
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
    commandType: 'nb.UpdateTodoContent',
    handler(command) {
      const { content } = command.data as { content: string }
      const { id } = command.path
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
    commandType: 'nb.ChangeTodoStatus',
    handler(command) {
      const { status } = command.data as { status: string }
      const { id } = command.path
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
    commandType: 'nb.DeleteTodo',
    handler(command) {
      const { id } = command.path
      return domainSuccess([{ type: 'TodoDeleted', data: { id }, streamId: `Todo-${id}` }])
    },
  },
]
