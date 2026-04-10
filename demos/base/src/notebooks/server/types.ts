import type { NotebookBase } from '../shared/index.js'

export interface Notebook extends NotebookBase {
  readonly id: string
}

export interface ListNotebooksResponse {
  readonly items: Notebook[]
  readonly nextCursor: string | null
}
