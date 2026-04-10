import type { EntityId } from '@cqrs-toolkit/client'
import type { TodoBase } from '../shared/index.js'

export interface Todo extends TodoBase {
  readonly id: EntityId
}
