import type { ProcessorRegistration } from '@cqrs-toolkit/client'
import { FILE_OBJECTS_COLLECTION_NAME } from '@cqrs-toolkit/demo-base/file-objects/domain'
import type {
  FileObject,
  FileObjectCreatedEvent,
  FileObjectDeletedEvent,
} from '@cqrs-toolkit/demo-base/file-objects/shared'
import { addRevision } from '../utils/processors.js'

export const fileObjectProcessors: ProcessorRegistration[] = [
  {
    eventTypes: 'FileObjectCreated',
    processor: (data: FileObjectCreatedEvent['data'], ctx) => ({
      collection: FILE_OBJECTS_COLLECTION_NAME,
      id: data.id,
      update: {
        type: 'set',
        data: addRevision<FileObject>(ctx, {
          id: data.id,
          noteId: data.noteId,
          notebookId: '',
          name: data.name,
          contentType: data.contentType,
          resource: data.resource,
          size: data.size,
          createdAt: data.createdAt,
        }),
      },
      isServerUpdate: ctx.persistence !== 'Anticipated',
    }),
  } satisfies ProcessorRegistration<FileObjectCreatedEvent['data'], FileObject>,
  {
    eventTypes: 'FileObjectDeleted',
    processor: (data: FileObjectDeletedEvent['data']) => ({
      collection: FILE_OBJECTS_COLLECTION_NAME,
      id: data.id,
      update: { type: 'delete' },
      isServerUpdate: true,
    }),
  },
]
