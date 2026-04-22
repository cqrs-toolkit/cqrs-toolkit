import { Collection } from '@cqrs-toolkit/client'
import { assert } from '@cqrs-toolkit/client/utils'
import {
  FileObjectAggregate,
  cacheKeysFromTopics,
  subscribeTopics,
} from '@cqrs-toolkit/demo-base/file-objects/domain'
import { NotebookAggregate } from '@cqrs-toolkit/demo-base/notebooks/domain'
import { NoteAggregate } from '@cqrs-toolkit/demo-base/notes/domain'
import type { ServiceLink } from '@meticoeus/ddd-es'
import { aggregateId, fetchSeedRecordPage, fetchStreamEventsAfter } from '../utils/collection.js'

export const fileObjectsCollection: Collection<ServiceLink> = {
  name: 'file_objects',
  aggregate: FileObjectAggregate,
  idReferences: [
    { path: '$.noteId', aggregate: NoteAggregate },
    { path: '$.notebookId', aggregate: NotebookAggregate },
  ],
  cacheKeysFromTopics,
  matchesStream: (streamId) => streamId.startsWith('storage.FileObject-'),
  seedOnDemand: {
    keyTypes: [{ kind: 'entity', link: { service: 'nb', type: 'Notebook' } }],
    subscribeTopics,
  },
  fetchSeedRecords: ({ ctx, cursor, limit, cacheKey }) => {
    assert(cacheKey.kind === 'entity', 'FileObjects collection requires an entity cache key')
    return fetchSeedRecordPage(ctx, `/file-objects?notebookId=${cacheKey.link.id}`, cursor, limit)
  },
  fetchStreamEvents: ({ ctx, streamId, afterRevision }) =>
    fetchStreamEventsAfter(ctx, `/file-objects/${aggregateId(streamId)}/events`, afterRevision),
}
