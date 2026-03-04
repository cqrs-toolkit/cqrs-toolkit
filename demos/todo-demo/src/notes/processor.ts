import type { ProcessorRegistration } from '@cqrs-toolkit/client'
import type {
  NoteBodyUpdatedEvent,
  NoteCreatedEvent,
  NoteDeletedEvent,
  NoteTitleUpdatedEvent,
} from '../../shared/notes/events'
import type { Note } from '../../shared/notes/types'

export const noteProcessors: ProcessorRegistration[] = [
  {
    eventTypes: 'NoteCreated',
    processor: (data: NoteCreatedEvent['data'], ctx) => ({
      collection: 'notes',
      id: data.id,
      update: {
        type: 'set',
        data: {
          id: data.id,
          title: data.title,
          body: data.body,
          createdAt: data.createdAt,
          updatedAt: data.createdAt,
          latestRevision: String(ctx.revision),
        } satisfies Note,
      },
      isServerUpdate: ctx.persistence !== 'Anticipated',
    }),
  },
  {
    eventTypes: 'NoteTitleUpdated',
    processor: (data: NoteTitleUpdatedEvent['data'], ctx) => ({
      collection: 'notes',
      id: data.id,
      update: {
        type: 'merge',
        data: {
          title: data.title,
          updatedAt: data.updatedAt,
          latestRevision: String(ctx.revision),
        },
      },
      isServerUpdate: ctx.persistence !== 'Anticipated',
    }),
  },
  {
    eventTypes: 'NoteBodyUpdated',
    processor: (data: NoteBodyUpdatedEvent['data'], ctx) => ({
      collection: 'notes',
      id: data.id,
      update: {
        type: 'merge',
        data: {
          body: data.body,
          updatedAt: data.updatedAt,
          latestRevision: String(ctx.revision),
        },
      },
      isServerUpdate: ctx.persistence !== 'Anticipated',
    }),
  },
  {
    eventTypes: 'NoteDeleted',
    processor: (data: NoteDeletedEvent['data']) => ({
      collection: 'notes',
      id: data.id,
      update: { type: 'delete' },
      isServerUpdate: true,
    }),
  },
]
