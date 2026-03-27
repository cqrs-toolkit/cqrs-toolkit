import type { ProcessorRegistration } from '@cqrs-toolkit/client'
import type {
  Notebook,
  NotebookCreatedEvent,
  NotebookDeletedEvent,
  NotebookNameUpdatedEvent,
  NotebookTagAddedEvent,
  NotebookTagRemovedEvent,
} from '@cqrs-toolkit/demo-base/notebooks/shared'
import { addRevision } from '../utils/processors.js'

export const notebookCommandEndpoints: Record<string, string> = {
  CreateNotebook: '/api/notebooks/commands',
  UpdateNotebookName: '/api/notebooks/commands',
  DeleteNotebook: '/api/notebooks/commands',
  AddNotebookTag: '/api/notebooks/commands',
  RemoveNotebookTag: '/api/notebooks/commands',
}

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
    eventTypes: 'NotebookTagAdded',
    processor: async (data: NotebookTagAddedEvent['data'], ctx) => {
      const current = await ctx.getCurrentState<Notebook>('notebooks', data.id)
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
    processor: async (data: NotebookTagRemovedEvent['data'], ctx) => {
      const current = await ctx.getCurrentState<Notebook>('notebooks', data.id)
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
