import { deriveScopeKey } from '@cqrs-toolkit/client'

export const TODOS_COLLECTION_NAME = 'todos'

export const TODO_SEED_KEY = deriveScopeKey({ scopeType: 'todos' })
