import type { Collection } from '@cqrs-toolkit/client'
import {
  FILE_OBJECTS_COLLECTION_NAME,
  FileObjectAggregate,
  cacheKeysFromTopics,
  subscribeTopics,
} from '@cqrs-toolkit/demo-base/file-objects/domain'
import { getGeneratedIdReferences } from '@cqrs-toolkit/hypermedia-client'
import type { ServiceLink } from '@meticoeus/ddd-es'
import { representations } from '../../cqrs/reps/manifest.js'
import { aggregateRegistry } from '../aggregate-registry.js'
import { appCreateCollection } from '../utils/collection.js'

export const fileObjectsCollection = {
  name: FILE_OBJECTS_COLLECTION_NAME,
  aggregate: FileObjectAggregate,
  idReferences: getGeneratedIdReferences(
    'urn:representation:storage.FileObject:1.0.0',
    representations,
    aggregateRegistry,
  ),
  cacheKeysFromTopics,
  matchesStream: (streamId: string) => streamId.startsWith('storage.FileObject-'),
  seedOnDemand: {
    keyTypes: [{ kind: 'entity', link: { service: 'nb', type: 'Notebook' } }],
    subscribeTopics,
  },
  ...appCreateCollection({
    representation: representations['storage:FileObject'],
  }),
} satisfies Collection<ServiceLink>
