/**
 * Todo command handlers — anticipated event production from validated data.
 */

import { createEntityId, domainSuccess } from '@cqrs-toolkit/client'
import { TodoAggregate } from '@cqrs-toolkit/demo-base/todos/domain'
import type { AppCommandHandlerRegistration } from '../utils/executors.js'

export const todoHandlers: AppCommandHandlerRegistration[] = [
  {
    commandType: 'nb.CreateTodo',
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
    commandType: 'nb.UpdateTodoContent',
    handler(command) {
      const { content } = command.data as { content: string }
      // TODO(command-types): Figure out how we can fix this
      const { id } = command.path as { id: string }
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
    commandType: 'nb.ChangeTodoStatus',
    handler(command) {
      const { status } = command.data as { status: string }
      // TODO(command-types): Figure out how we can fix this
      const { id } = command.path as { id: string }
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
    commandType: 'nb.DeleteTodo',
    handler(command) {
      // TODO(command-types): Figure out how we can fix this
      const { id } = command.path as { id: string }
      return domainSuccess([
        { type: 'TodoDeleted', data: { id }, streamId: TodoAggregate.getStreamId(id) },
      ])
    },
  },
]
