import { deriveScopeKey } from '@cqrs-toolkit/client'
import { NOTEBOOK_SEED_KEY } from '@cqrs-toolkit/demo-base/notebooks/domain'
import { representations } from '../../.cqrs/representations.js'
import { appCreateCollection } from '../utils/collection.js'

export const notebooksCollection = appCreateCollection({
  name: 'notebooks',
  representation: representations['nb:Notebook'],
  cacheKeysFromTopics: () => [NOTEBOOK_SEED_KEY],
  matchesStream: (streamId) => streamId.startsWith('Notebook-'),
  seedOnInit: {
    cacheKey: deriveScopeKey({ scopeType: 'notebooks' }),
    topics: ['Notebook:*'],
  },
})
