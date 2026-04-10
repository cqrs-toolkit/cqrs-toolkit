import type { EntityId } from '@cqrs-toolkit/client'
import type { NoteBase } from '../shared/index.js'

export interface Note extends NoteBase {
  readonly id: EntityId
  readonly notebookId: EntityId
}
