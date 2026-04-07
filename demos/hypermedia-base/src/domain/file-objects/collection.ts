import {
  FILE_OBJECTS_COLLECTION_NAME,
  cacheKeysFromTopics,
  subscribeTopics,
} from '@cqrs-toolkit/demo-base/file-objects/domain'
import { representations } from '../../.cqrs/representations.js'
import { appCreateCollection } from '../utils/collection.js'

export const fileObjectsCollection = appCreateCollection({
  name: FILE_OBJECTS_COLLECTION_NAME,
  representation: representations['storage:FileObject'],
  cacheKeysFromTopics,
  matchesStream: (streamId) => streamId.startsWith('FileObject-'),
  seedOnDemand: {
    keyTypes: [{ kind: 'entity', link: { service: 'nb', type: 'Notebook' } }],
    subscribeTopics,
  },
})
