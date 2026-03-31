import { cacheKeysFromTopics, subscribeTopics } from '@cqrs-toolkit/demo-base/notes/domain'
import { representations } from '../../.cqrs/representations.js'
import { appCreateCollection } from '../utils/collection.js'

export const notesCollection = appCreateCollection({
  name: 'notes',
  representation: representations['nb:Note'],
  cacheKeysFromTopics,
  matchesStream: (streamId) => streamId.startsWith('Note-'),
  seedOnDemand: {
    keyTypes: [{ kind: 'entity', link: { service: 'nb', type: 'Notebook' } }],
    subscribeTopics,
  },
})
