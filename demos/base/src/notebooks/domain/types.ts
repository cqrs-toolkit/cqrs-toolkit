import type { EntityId } from '@cqrs-toolkit/client'
import type { NotebookBase } from '../shared/index.js'

export interface Notebook extends NotebookBase {
  readonly id: EntityId
}
