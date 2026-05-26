import type { Collection } from '@cqrs-toolkit/client'
import {
  NOTES_COLLECTION_NAME,
  NoteAggregate,
  cacheKeysFromTopics,
  subscribeTopics,
} from '@cqrs-toolkit/demo-base/notes/domain'
import { getGeneratedIdReferences } from '@cqrs-toolkit/hypermedia-client'
import type { ServiceLink } from '@meticoeus/ddd-es'
import { representations } from '../../cqrs/reps/manifest.js'
import { aggregateRegistry } from '../aggregate-registry.js'
import { appCreateCollection } from '../utils/collection.js'

export const notesCollection = {
  name: NOTES_COLLECTION_NAME,
  aggregate: NoteAggregate,
  idReferences: getGeneratedIdReferences(
    'urn:representation:nb.Note:1.0.0',
    representations,
    aggregateRegistry,
  ),
  cacheKeysFromTopics,
  // Alphabetical by title (locale_en aware) — the sort_name virtual column
  // maps to `$.title`, defined in the schema migration; the comparator is
  // registered on cqrsConfig.collations.
  list: {
    defaultSort: [{ column: 'sort_name', direction: 'asc' }],
  },
  matchesStream: (streamId: string) => streamId.startsWith('nb.Note-'),
  seedOnDemand: {
    keyTypes: [{ kind: 'entity', link: { service: 'nb', type: 'Notebook' } }],
    subscribeTopics,
  },
  ...appCreateCollection({
    representation: representations['nb:Note'],
  }),
} satisfies Collection<ServiceLink>
