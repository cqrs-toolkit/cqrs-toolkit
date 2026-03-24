/**
 * Note entity and query response types.
 */

export interface Note {
  readonly id: string
  readonly notebookId: string
  readonly title: string
  readonly body: string
  readonly createdAt: string
  readonly updatedAt: string
  readonly latestRevision?: string | undefined
}

export interface ListNotesResponse {
  readonly items: Note[]
  readonly nextCursor: string | null
}
