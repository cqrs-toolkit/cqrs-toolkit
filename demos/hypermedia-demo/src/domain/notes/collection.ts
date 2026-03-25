import { deriveScopeKey } from '@cqrs-toolkit/client'
import { representations } from '../../.cqrs/representations.js'
import { appCreateCollection } from '../utils/collection.js'

export const notesCollection = appCreateCollection({
  name: 'notes',
  representation: representations['demo:Note'],
  getTopics: () => ['Notebook:*'],
  matchesStream: (streamId) => streamId.startsWith('Note-'),
  seedCacheKey: deriveScopeKey({ scopeType: 'notes' }),
})
