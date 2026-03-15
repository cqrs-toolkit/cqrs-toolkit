import type { ProcessorRegistration } from '@cqrs-toolkit/client'
import type {
  NoteBodyUpdatedEvent,
  NoteCreatedEvent,
  NoteDeletedEvent,
  NoteTitleUpdatedEvent,
} from '../../shared/notes/events.js'
import type { Note } from '../../shared/notes/types.js'
import { addRevision } from '../processors/utils.js'

export const noteProcessors: ProcessorRegistration[] = [
  {
    eventTypes: 'NoteCreated',
    processor: (data: NoteCreatedEvent['data'], ctx) => ({
      collection: 'notes',
      id: data.id,
      update: {
        type: 'set',
        data: addRevision<Note>(ctx, {
          id: data.id,
          title: data.title,
          body: data.body,
          createdAt: data.createdAt,
          updatedAt: data.createdAt,
        }),
      },
      isServerUpdate: ctx.persistence !== 'Anticipated',
    }),
  } satisfies ProcessorRegistration<NoteCreatedEvent['data'], Note>,
  {
    eventTypes: 'NoteTitleUpdated',
    processor: (data: NoteTitleUpdatedEvent['data'], ctx) => ({
      collection: 'notes',
      id: data.id,
      update: {
        type: 'merge',
        data: addRevision<Partial<Note>>(ctx, {
          title: data.title,
          updatedAt: data.updatedAt,
        }),
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
        data: addRevision<Partial<Note>>(ctx, {
          body: data.body,
          updatedAt: data.updatedAt,
        }),
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
