import { type Collection, deriveScopeKey } from '@cqrs-toolkit/client'
import type { ServiceLink } from '@meticoeus/ddd-es'
import { aggregateId, fetchSeedRecordPage, fetchStreamEventsAfter } from '../utils/collection.js'

export const notebooksCollection: Collection<ServiceLink> = {
  name: 'notebooks',
  seedCacheKey: deriveScopeKey({ scopeType: 'notebooks' }),
  getTopics: () => ['Notebook:*'],
  matchesStream: (streamId) => streamId.startsWith('Notebook-'),
  getStreamId: (entityId) => `Notebook-${entityId}`,
  fetchSeedRecords: ({ ctx, cursor, limit }) =>
    fetchSeedRecordPage(ctx, '/notebooks', cursor, limit),
  fetchStreamEvents: ({ ctx, streamId, afterRevision }) =>
    fetchStreamEventsAfter(ctx, `/notebooks/${aggregateId(streamId)}/events`, afterRevision),
}
