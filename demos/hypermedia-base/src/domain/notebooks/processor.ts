import type { ProcessorRegistration } from '@cqrs-toolkit/client'
import type { Notebook } from '@cqrs-toolkit/demo-base/notebooks/domain'
import type {
  NotebookCreatedEvent,
  NotebookDeletedEvent,
  NotebookNameUpdatedEvent,
  NotebookTagAddedEvent,
  NotebookTagRemovedEvent,
} from '@cqrs-toolkit/demo-base/notebooks/shared'
import { addRevision } from '../utils/processors.js'

export const notebookProcessors: ProcessorRegistration[] = [
  {
    eventTypes: 'NotebookCreated',
    processor: (data: NotebookCreatedEvent['data'], _state, ctx) => ({
      collection: 'notebooks',
      id: data.id,
      update: {
        type: 'set',
        data: addRevision<Notebook>(ctx, {
          id: data.id,
          name: data.name,
          tags: [],
          createdAt: data.createdAt,
          updatedAt: data.createdAt,
        }),
      },
      isServerUpdate: ctx.persistence !== 'Anticipated',
    }),
  } satisfies ProcessorRegistration<NotebookCreatedEvent['data'], Notebook>,
  {
    eventTypes: 'NotebookNameUpdated',
    processor: (data: NotebookNameUpdatedEvent['data'], _state, ctx) => ({
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
  {
    eventTypes: 'NotebookTagAdded',
    processor: (data: NotebookTagAddedEvent['data'], state, ctx) => {
      const current = state as Notebook | undefined
      const existingTags = current?.tags ?? []
      if (existingTags.includes(data.tag)) return undefined
      return {
        collection: 'notebooks',
        id: data.id,
        update: {
          type: 'merge',
          data: addRevision<Partial<Notebook>>(ctx, { tags: [...existingTags, data.tag] }),
        },
        isServerUpdate: ctx.persistence !== 'Anticipated',
      }
    },
  },
  {
    eventTypes: 'NotebookTagRemoved',
    processor: (data: NotebookTagRemovedEvent['data'], state, ctx) => {
      const current = state as Notebook | undefined
      const existingTags = current?.tags ?? []
      if (!existingTags.includes(data.tag)) return undefined
      return {
        collection: 'notebooks',
        id: data.id,
        update: {
          type: 'merge',
          data: addRevision<Partial<Notebook>>(ctx, {
            tags: existingTags.filter((t) => t !== data.tag),
          }),
        },
        isServerUpdate: ctx.persistence !== 'Anticipated',
      }
    },
  },
]
