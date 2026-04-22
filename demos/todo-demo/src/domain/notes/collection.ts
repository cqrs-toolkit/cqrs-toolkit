import { Collection } from '@cqrs-toolkit/client'
import { assert } from '@cqrs-toolkit/client/utils'
import { NotebookAggregate } from '@cqrs-toolkit/demo-base/notebooks/domain'
import {
  cacheKeysFromTopics,
  NoteAggregate,
  NOTES_COLLECTION_NAME,
  subscribeTopics,
} from '@cqrs-toolkit/demo-base/notes/domain'
import type { ServiceLink } from '@meticoeus/ddd-es'
import { aggregateId, fetchSeedRecordPage, fetchStreamEventsAfter } from '../utils/collection.js'

export const notesCollection: Collection<ServiceLink> = {
  name: NOTES_COLLECTION_NAME,
  aggregate: NoteAggregate,
  idReferences: [{ path: '$.notebookId', aggregate: NotebookAggregate }],
  cacheKeysFromTopics,
  matchesStream: (streamId) => streamId.startsWith('nb.Note-'),
  seedOnDemand: {
    keyTypes: [{ kind: 'entity', link: { service: 'nb', type: 'Notebook' } }],
    subscribeTopics,
  },
  fetchSeedRecords: ({ ctx, cursor, limit, cacheKey }) => {
    assert(cacheKey.kind === 'entity', 'Notes collection requires an entity cache key')
    return fetchSeedRecordPage(ctx, `/notes?notebookId=${cacheKey.link.id}`, cursor, limit)
  },
  fetchStreamEvents: ({ ctx, streamId, afterRevision }) =>
    fetchStreamEventsAfter(ctx, `/notes/${aggregateId(streamId)}/events`, afterRevision),
}
