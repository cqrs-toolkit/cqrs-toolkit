import { type Collection, deriveScopeKey } from '@cqrs-toolkit/client'
import type { ServiceLink } from '@meticoeus/ddd-es'
import { aggregateId, fetchSeedRecordPage, fetchStreamEventsAfter } from '../utils/collection.js'

export const notesCollection: Collection<ServiceLink> = {
  name: 'notes',
  seedCacheKey: deriveScopeKey({ scopeType: 'notes' }),
  getTopics: () => ['Notebook:*'],
  matchesStream: (streamId) => streamId.startsWith('Note-'),
  getStreamId: (entityId) => `Note-${entityId}`,
  fetchSeedRecords: ({ ctx, cursor, limit }) => fetchSeedRecordPage(ctx, '/notes', cursor, limit),
  fetchStreamEvents: ({ ctx, streamId, afterRevision }) =>
    fetchStreamEventsAfter(ctx, `/notes/${aggregateId(streamId)}/events`, afterRevision),
}
