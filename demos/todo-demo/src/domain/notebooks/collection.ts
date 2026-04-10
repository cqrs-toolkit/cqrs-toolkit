import { type Collection } from '@cqrs-toolkit/client'
import {
  NOTEBOOK_SEED_KEY,
  NotebookAggregate,
  NOTEBOOKS_COLLECTION_NAME,
} from '@cqrs-toolkit/demo-base/notebooks/domain'
import type { ServiceLink } from '@meticoeus/ddd-es'
import { aggregateId, fetchSeedRecordPage, fetchStreamEventsAfter } from '../utils/collection.js'

export const notebooksCollection: Collection<ServiceLink> = {
  name: NOTEBOOKS_COLLECTION_NAME,
  aggregate: NotebookAggregate,
  cacheKeysFromTopics: () => [NOTEBOOK_SEED_KEY],
  seedOnInit: {
    cacheKey: NOTEBOOK_SEED_KEY,
    topics: ['Notebook:*'],
  },
  matchesStream: (streamId) => streamId.startsWith('Notebook-'),
  fetchSeedRecords: ({ ctx, cursor, limit }) =>
    fetchSeedRecordPage(ctx, '/notebooks', cursor, limit),
  fetchStreamEvents: ({ ctx, streamId, afterRevision }) =>
    fetchStreamEventsAfter(ctx, `/notebooks/${aggregateId(streamId)}/events`, afterRevision),
}
