import { deriveScopeKey } from '@cqrs-toolkit/client'

export const NOTEBOOKS_COLLECTION_NAME = 'notebooks'

export const NOTEBOOK_SEED_KEY = deriveScopeKey({ scopeType: 'notebooks' })
