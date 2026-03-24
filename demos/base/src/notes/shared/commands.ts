/**
 * Note command types, command union, and ajv validation schemas.
 */

import type { JSONSchema7 } from 'json-schema'

export type NoteCommandType = 'CreateNote' | 'UpdateNoteTitle' | 'UpdateNoteBody' | 'DeleteNote'

export type NoteCommand =
  | CreateNoteCommand
  | UpdateNoteTitleCommand
  | UpdateNoteBodyCommand
  | DeleteNoteCommand

export interface CreateNoteCommand {
  readonly type: 'CreateNote'
  readonly data: {
    readonly notebookId: string
    readonly title: string
    readonly body: string
  }
}

export const createNotePayloadSchema = {
  type: 'object',
  properties: {
    notebookId: { type: 'string', minLength: 1 },
    title: { type: 'string', minLength: 1 },
    body: { type: 'string' },
  },
  required: ['notebookId', 'title', 'body'],
  additionalProperties: false,
} satisfies JSONSchema7

export interface UpdateNoteTitleCommand {
  readonly type: 'UpdateNoteTitle'
  readonly data: {
    readonly id: string
    readonly title: string
  }
}

export const updateNoteTitlePayloadSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', minLength: 1 },
    title: { type: 'string', minLength: 1 },
  },
  required: ['id', 'title'],
  additionalProperties: false,
} satisfies JSONSchema7

export interface UpdateNoteBodyCommand {
  readonly type: 'UpdateNoteBody'
  readonly data: {
    readonly id: string
    readonly body: string
  }
}

export const updateNoteBodyPayloadSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', minLength: 1 },
    body: { type: 'string' },
  },
  required: ['id', 'body'],
  additionalProperties: false,
} satisfies JSONSchema7

export interface DeleteNoteCommand {
  readonly type: 'DeleteNote'
  readonly data: {
    readonly id: string
  }
}

export const deleteNotePayloadSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', minLength: 1 },
  },
  required: ['id'],
  additionalProperties: false,
} satisfies JSONSchema7
