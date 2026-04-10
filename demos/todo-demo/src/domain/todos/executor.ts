/**
 * Todo command handlers — anticipated event production from validated data.
 */

import { createEntityId, domainSuccess } from '@cqrs-toolkit/client'
import { TodoAggregate } from '@cqrs-toolkit/demo-base/todos/domain'
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
    handler(command, _state, context) {
      const { content } = command.data as { content: string }
      const id = createEntityId(context)
      const now = new Date().toISOString()
      return domainSuccess([
        {
          type: 'TodoCreated',
          data: { id, content, status: 'pending', createdAt: now },
          streamId: TodoAggregate.getStreamId(id),
        },
      ])
    },
  },
  {
    commandType: 'UpdateTodoContent',
    schema: updateTodoContentPayloadSchema,
    handler(command) {
      const { id, content } = command.data as { id: string; content: string }
      return domainSuccess([
        {
          type: 'TodoContentUpdated',
          data: { id, content, updatedAt: new Date().toISOString() },
          streamId: TodoAggregate.getStreamId(id),
        },
      ])
    },
  },
  {
    commandType: 'ChangeTodoStatus',
    schema: changeTodoStatusPayloadSchema,
    handler(command) {
      const { id, status } = command.data as { id: string; status: string }
      return domainSuccess([
        {
          type: 'TodoStatusChanged',
          data: { id, status, updatedAt: new Date().toISOString() },
          streamId: TodoAggregate.getStreamId(id),
        },
      ])
    },
  },
  {
    commandType: 'DeleteTodo',
    schema: deleteTodoPayloadSchema,
    handler(command) {
      const { id } = command.data as { id: string }
      return domainSuccess([
        {
          type: 'TodoDeleted',
          data: { id },
          streamId: TodoAggregate.getStreamId(id),
        },
      ])
    },
  },
]
