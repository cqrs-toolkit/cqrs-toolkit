import type { ProcessorRegistration } from '@cqrs-toolkit/client'
import type {
  TodoContentUpdatedEvent,
  TodoCreatedEvent,
  TodoDeletedEvent,
  TodoStatusChangedEvent,
} from '../../shared/todos/events'
import type { Todo } from '../../shared/todos/types'

export const todoProcessors: ProcessorRegistration[] = [
  {
    eventTypes: 'TodoCreated',
    processor: (data: TodoCreatedEvent['data'], ctx) => ({
      collection: 'todos',
      id: data.id,
      update: {
        type: 'set',
        data: {
          id: data.id,
          content: data.content,
          status: data.status,
          createdAt: data.createdAt,
          updatedAt: data.createdAt,
          latestRevision: ctx.revision ?? '0',
        } satisfies Todo,
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
        data: {
          content: data.content,
          updatedAt: data.updatedAt,
          ...(ctx.revision !== undefined ? { latestRevision: ctx.revision } : {}),
        },
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
        data: {
          status: data.status,
          updatedAt: data.updatedAt,
          ...(ctx.revision !== undefined ? { latestRevision: ctx.revision } : {}),
        },
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
