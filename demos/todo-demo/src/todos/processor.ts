import { type ProcessorRegistration } from '@cqrs-toolkit/client'
import type {
  TodoContentUpdatedEvent,
  TodoCreatedEvent,
  TodoDeletedEvent,
  TodoStatusChangedEvent,
} from '../../shared/todos/events.js'
import type { Todo } from '../../shared/todos/types.js'
import { addRevision } from '../processors/utils.js'

export const todoProcessors: ProcessorRegistration[] = [
  {
    eventTypes: 'TodoCreated',
    processor: (data: TodoCreatedEvent['data'], ctx) => ({
      collection: 'todos',
      id: data.id,
      update: {
        type: 'set',
        data: addRevision<Todo>(ctx, {
          id: data.id,
          content: data.content,
          status: data.status,
          createdAt: data.createdAt,
          updatedAt: data.createdAt,
        }),
      },
      isServerUpdate: ctx.persistence !== 'Anticipated',
    }),
  },
  {
    eventTypes: 'TodoContentUpdated',
    processor: (data: TodoContentUpdatedEvent['data'], ctx) => ({
      collection: 'todos',
      id: data.id,
      update: {
        type: 'merge',
        data: addRevision<Partial<Todo>>(ctx, {
          content: data.content,
          updatedAt: data.updatedAt,
        }),
      },
      isServerUpdate: ctx.persistence !== 'Anticipated',
    }),
  },
  {
    eventTypes: 'TodoStatusChanged',
    processor: (data: TodoStatusChangedEvent['data'], ctx) => ({
      collection: 'todos',
      id: data.id,
      update: {
        type: 'merge',
        data: addRevision<Partial<Todo>>(ctx, {
          status: data.status,
          updatedAt: data.updatedAt,
        }),
      },
      isServerUpdate: ctx.persistence !== 'Anticipated',
    }),
  },
  {
    eventTypes: 'TodoDeleted',
    processor: (data: TodoDeletedEvent['data']) => ({
      collection: 'todos',
      id: data.id,
      update: { type: 'delete' },
      isServerUpdate: true,
    }),
  },
]
