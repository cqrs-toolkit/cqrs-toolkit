import { deriveScopeKey } from '@cqrs-toolkit/client'
import { representations } from '../../.cqrs/representations.js'
import { appCreateCollection } from '../utils/collection.js'

export const todosCollection = appCreateCollection({
  name: 'todos',
  representation: representations['demo:Todo'],
  getTopics: () => ['Todo:*'],
  matchesStream: (streamId) => streamId.startsWith('Todo-'),
  seedCacheKey: deriveScopeKey({ scopeType: 'todos' }),
})
