/**
 * Generated types — do not edit.
 * Regenerate with: cqrs-toolkit client pull
 */

import type { EntityId } from '@cqrs-toolkit/client'

export interface NbAddNotebookTagV1_0_0 {
  tag: string
}

export interface NbChangeTodoStatusV1_0_0 {
  status: 'pending' | 'in_progress' | 'completed'
}

export interface NbCreateNoteV1_0_0 {
  body: string
  notebookId: EntityId
  title: string
}

export interface NbCreateNotebookV1_0_0 {
  name: string
}

export interface NbCreateTodoV1_0_0 {
  content: string
}

export interface NbDeleteNoteV1_0_0 {}

export interface NbDeleteNotebookV1_0_0 {}

export interface NbDeleteTodoV1_0_0 {}

export interface NbRemoveNotebookTagV1_0_0 {
  tag: string
}

export interface NbUpdateNoteBodyV1_0_0 {
  body: string
}

export interface NbUpdateNoteTitleV1_0_0 {
  title: string
}

export interface NbUpdateNotebookNameV1_0_0 {
  name: string
}

export interface NbUpdateTodoContentV1_0_0 {
  content: string
}

export interface StorageCreateFileObjectV1_0_0 {
  filename: string
  noteId: EntityId
  size: number
}

export interface StorageDeleteFileObjectV1_0_0 {}
