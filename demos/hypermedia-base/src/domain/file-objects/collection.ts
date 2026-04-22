import {
  FILE_OBJECTS_COLLECTION_NAME,
  FileObjectAggregate,
  cacheKeysFromTopics,
  subscribeTopics,
} from '@cqrs-toolkit/demo-base/file-objects/domain'
import { NotebookAggregate } from '@cqrs-toolkit/demo-base/notebooks/domain'
import { NoteAggregate } from '@cqrs-toolkit/demo-base/notes/domain'
import { representations } from '../../cqrs/representations.js'
import { appCreateCollection } from '../utils/collection.js'

export const fileObjectsCollection = appCreateCollection({
  name: FILE_OBJECTS_COLLECTION_NAME,
  aggregate: FileObjectAggregate,
  idReferences: [
    { path: '$.noteId', aggregate: NoteAggregate },
    { path: '$.notebookId', aggregate: NotebookAggregate },
  ],
  representation: representations['storage:FileObject'],
  cacheKeysFromTopics,
  matchesStream: (streamId) => streamId.startsWith('storage.FileObject-'),
  seedOnDemand: {
    keyTypes: [{ kind: 'entity', link: { service: 'nb', type: 'Notebook' } }],
    subscribeTopics,
  },
})
