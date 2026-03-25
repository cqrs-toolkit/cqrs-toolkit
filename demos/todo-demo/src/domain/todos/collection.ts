import { type Collection, deriveScopeKey } from '@cqrs-toolkit/client'
import type { ServiceLink } from '@meticoeus/ddd-es'
import { aggregateId, fetchSeedRecordPage, fetchStreamEventsAfter } from '../utils/collection.js'

export const todosCollection: Collection<ServiceLink> = {
  name: 'todos',
  seedCacheKey: deriveScopeKey({ scopeType: 'todos' }),
  getTopics: () => ['Todo:*'],
  matchesStream: (streamId) => streamId.startsWith('Todo-'),
  getStreamId: (entityId) => `Todo-${entityId}`,
  fetchSeedRecords: ({ ctx, cursor, limit }) => fetchSeedRecordPage(ctx, '/todos', cursor, limit),
  fetchStreamEvents: ({ ctx, streamId, afterRevision }) =>
    fetchStreamEventsAfter(ctx, `/todos/${aggregateId(streamId)}/events`, afterRevision),
}
