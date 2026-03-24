/**
 * Todo command handlers — anticipated event production from validated data.
 */

import { createEntityId, domainSuccess, type HandlerContext } from '@cqrs-toolkit/client'
import {
  changeTodoStatusPayloadSchema,
  createTodoPayloadSchema,
  deleteTodoPayloadSchema,
  updateTodoContentPayloadSchema,
} from '@cqrs-toolkit/demo-base/todos/shared'
import type { AppCommandHandlerRegistration } from '../utils/executors.js'

export const todoHandlers: AppCommandHandlerRegistration[] = [
  {
    commandType: 'CreateTodo',
    schema: createTodoPayloadSchema,
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
    schema: updateTodoContentPayloadSchema,
    handler(data: { id: string; content: string }) {
      return domainSuccess([
        {
          type: 'TodoContentUpdated',
          data: { id: data.id, content: data.content, updatedAt: new Date().toISOString() },
          streamId: `Todo-${data.id}`,
        },
      ])
    },
  },
  {
    commandType: 'ChangeTodoStatus',
    schema: changeTodoStatusPayloadSchema,
    handler(data: { id: string; status: string }) {
      return domainSuccess([
        {
          type: 'TodoStatusChanged',
          data: { id: data.id, status: data.status, updatedAt: new Date().toISOString() },
          streamId: `Todo-${data.id}`,
        },
      ])
    },
  },
  {
    commandType: 'DeleteTodo',
    schema: deleteTodoPayloadSchema,
    handler(data: { id: string }) {
      return domainSuccess([
        { type: 'TodoDeleted', data: { id: data.id }, streamId: `Todo-${data.id}` },
      ])
    },
  },
]
