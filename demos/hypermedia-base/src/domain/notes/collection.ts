import { NotebookAggregate } from '@cqrs-toolkit/demo-base/notebooks/domain'
import {
  cacheKeysFromTopics,
  NoteAggregate,
  subscribeTopics,
} from '@cqrs-toolkit/demo-base/notes/domain'
import { representations } from '../../cqrs/representations.js'
import { appCreateCollection } from '../utils/collection.js'

export const notesCollection = appCreateCollection({
  name: 'notes',
  aggregate: NoteAggregate,
  idReferences: [{ path: '$.notebookId', aggregate: NotebookAggregate }],
  representation: representations['nb:Note'],
  cacheKeysFromTopics,
  matchesStream: (streamId) => streamId.startsWith('nb.Note-'),
  seedOnDemand: {
    keyTypes: [{ kind: 'entity', link: { service: 'nb', type: 'Notebook' } }],
    subscribeTopics,
  },
})
