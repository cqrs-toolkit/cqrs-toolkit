import { deriveScopeKey } from '@cqrs-toolkit/client'

export const NOTEBOOK_SEED_KEY = deriveScopeKey({ scopeType: 'notebooks' })
