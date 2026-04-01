import {
  NOTEBOOK_SEED_KEY,
  NOTEBOOKS_COLLECTION_NAME,
} from '@cqrs-toolkit/demo-base/notebooks/domain'
import { representations } from '../../.cqrs/representations.js'
import { appCreateCollection } from '../utils/collection.js'

export const notebooksCollection = appCreateCollection({
  name: NOTEBOOKS_COLLECTION_NAME,
  representation: representations['nb:Notebook'],
  cacheKeysFromTopics: () => [NOTEBOOK_SEED_KEY],
  matchesStream: (streamId) => streamId.startsWith('Notebook-'),
  seedOnInit: {
    cacheKey: NOTEBOOK_SEED_KEY,
    topics: ['Notebook:*'],
  },
})
