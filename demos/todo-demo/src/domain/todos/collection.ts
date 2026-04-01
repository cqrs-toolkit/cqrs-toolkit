import type { Collection } from '@cqrs-toolkit/client'
import { TODO_SEED_KEY, TODOS_COLLECTION_NAME } from '@cqrs-toolkit/demo-base/todos/domain'
import type { ServiceLink } from '@meticoeus/ddd-es'
import { aggregateId, fetchSeedRecordPage, fetchStreamEventsAfter } from '../utils/collection.js'

export const todosCollection: Collection<ServiceLink> = {
  name: TODOS_COLLECTION_NAME,
  cacheKeysFromTopics: () => [TODO_SEED_KEY],
  seedOnInit: {
    cacheKey: TODO_SEED_KEY,
    topics: ['Todo:*'],
  },
  matchesStream: (streamId) => streamId.startsWith('Todo-'),
  getStreamId: (entityId) => `Todo-${entityId}`,
  fetchSeedRecords: ({ ctx, cursor, limit }) => fetchSeedRecordPage(ctx, '/todos', cursor, limit),
  fetchStreamEvents: ({ ctx, streamId, afterRevision }) =>
    fetchStreamEventsAfter(ctx, `/todos/${aggregateId(streamId)}/events`, afterRevision),
}
