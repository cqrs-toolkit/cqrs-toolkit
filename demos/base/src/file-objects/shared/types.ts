/**
 * FileObject entity and query response types.
 */

export interface FileObject {
  readonly id: string
  readonly noteId: string
  readonly notebookId: string
  readonly name: string
  readonly contentType: string
  readonly resource: string
  readonly size: number
  readonly createdAt: string
  readonly latestRevision?: string | undefined
}

export interface ListFileObjectsResponse {
  readonly items: FileObject[]
  readonly nextCursor: string | null
}
