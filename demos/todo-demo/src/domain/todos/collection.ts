import { type Collection } from '@cqrs-toolkit/client'
import {
  TODO_SEED_KEY,
  TodoAggregate,
  TODOS_COLLECTION_NAME,
} from '@cqrs-toolkit/demo-base/todos/domain'
import type { ServiceLink } from '@meticoeus/ddd-es'
import { aggregateId, fetchSeedRecordPage, fetchStreamEventsAfter } from '../utils/collection.js'

export const todosCollection: Collection<ServiceLink> = {
  name: TODOS_COLLECTION_NAME,
  aggregate: TodoAggregate,
  cacheKeysFromTopics: () => [TODO_SEED_KEY],
  seedOnInit: {
    cacheKey: TODO_SEED_KEY,
    topics: ['Todo:*'],
  },
  // Most-recent-first by default. Library-owned column, so the same sort
  // works under both the SQLite and the in-memory storage backends.
  list: {
    defaultSort: [{ column: 'updated_at', direction: 'desc' }],
  },
  matchesStream: (streamId) => streamId.startsWith('nb.Todo-'),
  fetchSeedRecords: ({ ctx, cursor, limit }) => fetchSeedRecordPage(ctx, '/todos', cursor, limit),
  fetchStreamEvents: ({ ctx, streamId, afterRevision }) =>
    fetchStreamEventsAfter(ctx, `/todos/${aggregateId(streamId)}/events`, afterRevision),
}
