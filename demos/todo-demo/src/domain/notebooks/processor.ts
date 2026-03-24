import type { ProcessorRegistration } from '@cqrs-toolkit/client'
import type {
  Notebook,
  NotebookCreatedEvent,
  NotebookDeletedEvent,
  NotebookNameUpdatedEvent,
} from '@cqrs-toolkit/demo-base/notebooks/shared'
import { addRevision } from '../utils/processors.js'

export const notebookProcessors: ProcessorRegistration[] = [
  {
    eventTypes: 'NotebookCreated',
    processor: (data: NotebookCreatedEvent['data'], ctx) => ({
      collection: 'notebooks',
      id: data.id,
      update: {
        type: 'set',
        data: addRevision<Notebook>(ctx, {
          id: data.id,
          name: data.name,
          createdAt: data.createdAt,
          updatedAt: data.createdAt,
        }),
      },
      isServerUpdate: ctx.persistence !== 'Anticipated',
    }),
  } satisfies ProcessorRegistration<NotebookCreatedEvent['data'], Notebook>,
  {
    eventTypes: 'NotebookNameUpdated',
    processor: (data: NotebookNameUpdatedEvent['data'], ctx) => ({
      collection: 'notebooks',
      id: data.id,
      update: {
        type: 'merge',
        data: addRevision<Partial<Notebook>>(ctx, {
          name: data.name,
          updatedAt: data.updatedAt,
        }),
      },
      isServerUpdate: ctx.persistence !== 'Anticipated',
    }),
  },
  {
    eventTypes: 'NotebookDeleted',
    processor: (data: NotebookDeletedEvent['data']) => ({
      collection: 'notebooks',
      id: data.id,
      update: { type: 'delete' },
      isServerUpdate: true,
    }),
  },
]
