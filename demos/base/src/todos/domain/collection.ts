import { deriveScopeKey } from '@cqrs-toolkit/client'

export const TODO_SEED_KEY = deriveScopeKey({ scopeType: 'todos' })
