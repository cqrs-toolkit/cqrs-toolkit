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
  // Alphabetical by name (locale_en aware) — drives both the notebook list
  // page and the dashboard's "recent notebooks" panel. The sort_name
  // virtual column lives in the schema migration; the locale_en collation
  // is registered on cqrsConfig.collations.
  list: {
    defaultSort: [{ column: 'sort_name', direction: 'asc' }],
  },
  matchesStream: (streamId) => streamId.startsWith('nb.Notebook-'),
  fetchSeedRecords: ({ ctx, cursor, limit }) =>
    fetchSeedRecordPage(ctx, '/notebooks', cursor, limit),
  fetchStreamEvents: ({ ctx, streamId, afterRevision }) =>
    fetchStreamEventsAfter(ctx, `/notebooks/${aggregateId(streamId)}/events`, afterRevision),
}
