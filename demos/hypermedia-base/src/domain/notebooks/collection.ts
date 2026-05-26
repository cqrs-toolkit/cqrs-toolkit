import type { Collection } from '@cqrs-toolkit/client'
import {
  NOTEBOOK_SEED_KEY,
  NotebookAggregate,
  NOTEBOOKS_COLLECTION_NAME,
} from '@cqrs-toolkit/demo-base/notebooks/domain'
import type { ServiceLink } from '@meticoeus/ddd-es'
import { representations } from '../../cqrs/reps/manifest.js'
import { appCreateCollection } from '../utils/collection.js'

export const notebooksCollection = {
  name: NOTEBOOKS_COLLECTION_NAME,
  aggregate: NotebookAggregate,
  cacheKeysFromTopics: () => [NOTEBOOK_SEED_KEY],
  matchesStream: (streamId: string) => streamId.startsWith('nb.Notebook-'),
  seedOnInit: {
    cacheKey: NOTEBOOK_SEED_KEY,
    topics: ['Notebook:*'],
  },
  // Alphabetical by name (locale_en aware) — drives both the notebook list
  // page and the dashboard's "recent notebooks" panel. The sort_name
  // virtual column lives in the schema migration; the locale_en collation
  // is registered on cqrsConfig.collations.
  list: {
    defaultSort: [{ column: 'sort_name', direction: 'asc' }],
  },
  ...appCreateCollection({
    representation: representations['nb:Notebook'],
  }),
} satisfies Collection<ServiceLink>
