/**
 * Note command types, command union, and ajv validation schemas.
 */

import type { JSONSchemaType } from 'ajv'

export type NoteCommandType = 'CreateNote' | 'UpdateNoteTitle' | 'UpdateNoteBody' | 'DeleteNote'

export type NoteCommand =
  | CreateNoteCommand
  | UpdateNoteTitleCommand
  | UpdateNoteBodyCommand
  | DeleteNoteCommand

export interface CreateNoteCommand {
  readonly type: 'CreateNote'
  readonly payload: {
    readonly title: string
    readonly body: string
  }
}

export interface UpdateNoteTitleCommand {
  readonly type: 'UpdateNoteTitle'
  readonly payload: {
    readonly id: string
    readonly title: string
    readonly revision: string
  }
}

export interface UpdateNoteBodyCommand {
  readonly type: 'UpdateNoteBody'
  readonly payload: {
    readonly id: string
    readonly body: string
    readonly revision: string
  }
}

export interface DeleteNoteCommand {
  readonly type: 'DeleteNote'
  readonly payload: {
    readonly id: string
    readonly revision: string
  }
}

// --- ajv schemas for command payloads ---

export const createNotePayloadSchema: JSONSchemaType<CreateNoteCommand['payload']> = {
  type: 'object',
  properties: {
    title: { type: 'string', minLength: 1 },
    body: { type: 'string' },
  },
  required: ['title', 'body'],
  additionalProperties: false,
}

export const updateNoteTitlePayloadSchema: JSONSchemaType<UpdateNoteTitleCommand['payload']> = {
  type: 'object',
  properties: {
    id: { type: 'string', minLength: 1 },
    title: { type: 'string', minLength: 1 },
    revision: { type: 'string', minLength: 1 },
  },
  required: ['id', 'title', 'revision'],
  additionalProperties: false,
}

export const updateNoteBodyPayloadSchema: JSONSchemaType<UpdateNoteBodyCommand['payload']> = {
  type: 'object',
  properties: {
    id: { type: 'string', minLength: 1 },
    body: { type: 'string' },
    revision: { type: 'string', minLength: 1 },
  },
  required: ['id', 'body', 'revision'],
  additionalProperties: false,
}

export const deleteNotePayloadSchema: JSONSchemaType<DeleteNoteCommand['payload']> = {
  type: 'object',
  properties: {
    id: { type: 'string', minLength: 1 },
    revision: { type: 'string', minLength: 1 },
  },
  required: ['id', 'revision'],
  additionalProperties: false,
}
