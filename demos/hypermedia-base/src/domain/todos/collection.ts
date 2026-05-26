import { type Collection, deriveScopeKey } from '@cqrs-toolkit/client'
import {
  TODO_SEED_KEY,
  TodoAggregate,
  TODOS_COLLECTION_NAME,
} from '@cqrs-toolkit/demo-base/todos/domain'
import type { ServiceLink } from '@meticoeus/ddd-es'
import { representations } from '../../cqrs/reps/manifest.js'
import { appCreateCollection } from '../utils/collection.js'

export const todosCollection = {
  name: TODOS_COLLECTION_NAME,
  aggregate: TodoAggregate,
  cacheKeysFromTopics: () => [TODO_SEED_KEY],
  matchesStream: (streamId: string) => streamId.startsWith('nb.Todo-'),
  seedOnInit: {
    cacheKey: deriveScopeKey({ scopeType: 'todos' }),
    topics: ['Todo:*'],
  },
  // Most-recent-first by default. Library-owned column, so the same sort
  // works under both the SQLite and the in-memory storage backends.
  list: {
    defaultSort: [{ column: 'updated_at', direction: 'desc' }],
  },
  ...appCreateCollection({
    representation: representations['nb:Todo'],
  }),
} satisfies Collection<ServiceLink>
