import type { NoteBase } from '../shared/index.js'

export interface Note extends NoteBase {
  readonly id: string
  readonly notebookId: string
}

export interface ListNotesResponse {
  readonly items: Note[]
  readonly nextCursor: string | null
}
