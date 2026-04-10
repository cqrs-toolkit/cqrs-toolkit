import type { ProcessorRegistration } from '@cqrs-toolkit/client'
import type { FileObject } from '@cqrs-toolkit/demo-base/file-objects/domain'
import type {
  FileObjectCreatedEvent,
  FileObjectDeletedEvent,
} from '@cqrs-toolkit/demo-base/file-objects/shared'
import { addRevision } from '../utils/processors.js'
import { fileObjectsCollection } from './collection.js'

export const fileObjectCommandEndpoints: Record<string, string> = {
  CreateFileObject: '/api/file-objects/commands',
  DeleteFileObject: '/api/file-objects/commands',
}

export const fileObjectProcessors: ProcessorRegistration[] = [
  {
    eventTypes: 'FileObjectCreated',
    processor: (data: FileObjectCreatedEvent['data'], ctx) => ({
      collection: fileObjectsCollection.name,
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
      collection: fileObjectsCollection.name,
      id: data.id,
      update: { type: 'delete' },
      isServerUpdate: true,
    }),
  },
]
