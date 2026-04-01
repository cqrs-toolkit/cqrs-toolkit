import { Collection } from '@cqrs-toolkit/client'
import { assert } from '@cqrs-toolkit/client/utils'
import {
  cacheKeysFromTopics,
  NOTES_COLLECTION_NAME,
  subscribeTopics,
} from '@cqrs-toolkit/demo-base/notes/domain'
import type { ServiceLink } from '@meticoeus/ddd-es'
import { aggregateId, fetchSeedRecordPage, fetchStreamEventsAfter } from '../utils/collection.js'

export const notesCollection: Collection<ServiceLink> = {
  name: NOTES_COLLECTION_NAME,
  cacheKeysFromTopics,
  matchesStream: (streamId) => streamId.startsWith('Note-'),
  getStreamId: (entityId) => `Note-${entityId}`,
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
