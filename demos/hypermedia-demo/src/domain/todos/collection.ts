import { deriveScopeKey } from '@cqrs-toolkit/client'
import { TODO_SEED_KEY } from '@cqrs-toolkit/demo-base/todos/domain'
import { representations } from '../../.cqrs/representations.js'
import { appCreateCollection } from '../utils/collection.js'

export const todosCollection = appCreateCollection({
  name: 'todos',
  representation: representations['demo:Todo'],
  cacheKeysFromTopics: () => [TODO_SEED_KEY],
  matchesStream: (streamId) => streamId.startsWith('Todo-'),
  seedOnInit: {
    cacheKey: deriveScopeKey({ scopeType: 'todos' }),
    topics: ['Todo:*'],
  },
})
