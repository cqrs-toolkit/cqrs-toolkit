import type { EntityId } from '@cqrs-toolkit/client'
import type { FileObjectBase } from '../shared/index.js'

export interface FileObject extends FileObjectBase {
  readonly id: EntityId
  readonly noteId: EntityId
  readonly notebookId: EntityId
}
