/**
 * Todo command handlers — anticipated event production from validated data.
 */

import { createEntityId, domainSuccess, type HandlerContext } from '@cqrs-toolkit/client'
import type { AppCommandHandlerRegistration } from '../utils/executors.js'

export const todoHandlers: AppCommandHandlerRegistration[] = [
  {
    commandType: 'CreateTodo',
    creates: { eventType: 'TodoCreated', idStrategy: 'temporary' },
    handler(data: { content: string }, context: HandlerContext) {
      const id = createEntityId(context)
      const now = new Date().toISOString()
      return domainSuccess([
        {
          type: 'TodoCreated',
          data: { id, content: data.content, status: 'pending', createdAt: now },
          streamId: `Todo-${id}`,
        },
      ])
    },
  },
  {
    commandType: 'UpdateTodoContent',
    handler(data: { content: string }, context: HandlerContext) {
      const { id } = context.path as { id: string }
      return domainSuccess([
        {
          type: 'TodoContentUpdated',
          data: { id, content: data.content, updatedAt: new Date().toISOString() },
          streamId: `Todo-${id}`,
        },
      ])
    },
  },
  {
    commandType: 'ChangeTodoStatus',
    handler(data: { status: string }, context: HandlerContext) {
      const { id } = context.path as { id: string }
      return domainSuccess([
        {
          type: 'TodoStatusChanged',
          data: { id, status: data.status, updatedAt: new Date().toISOString() },
          streamId: `Todo-${id}`,
        },
      ])
    },
  },
  {
    commandType: 'DeleteTodo',
    handler(_data: unknown, context: HandlerContext) {
      const { id } = context.path as { id: string }
      return domainSuccess([{ type: 'TodoDeleted', data: { id }, streamId: `Todo-${id}` }])
    },
  },
]
