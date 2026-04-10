import type { FileObjectBase } from '../shared/index.js'

export interface FileObject extends FileObjectBase {
  readonly id: string
  readonly noteId: string
  readonly notebookId: string
}

export interface ListFileObjectsResponse {
  readonly items: FileObject[]
  readonly nextCursor: string | null
}
