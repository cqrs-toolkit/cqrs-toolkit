import { deriveScopeKey } from '@cqrs-toolkit/client'
import { representations } from '../../.cqrs/representations.js'
import { appCreateCollection } from '../utils/collection.js'

export const notebooksCollection = appCreateCollection({
  name: 'notebooks',
  representation: representations['demo:Notebook'],
  getTopics: () => ['Notebook:*'],
  matchesStream: (streamId) => streamId.startsWith('Notebook-'),
  seedCacheKey: deriveScopeKey({ scopeType: 'notebooks' }),
})
