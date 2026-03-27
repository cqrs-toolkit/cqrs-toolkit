/**
 * Notebook command types, command union, and validation schemas.
 */

import type { JSONSchema7 } from 'json-schema'

export type NotebookCommandType =
  | 'CreateNotebook'
  | 'UpdateNotebookName'
  | 'DeleteNotebook'
  | 'AddNotebookTag'
  | 'RemoveNotebookTag'

export type NotebookCommand =
  | CreateNotebookCommand
  | UpdateNotebookNameCommand
  | DeleteNotebookCommand
  | AddNotebookTagCommand
  | RemoveNotebookTagCommand

export interface CreateNotebookCommand {
  readonly type: 'CreateNotebook'
  readonly data: {
    readonly name: string
  }
}

export const createNotebookPayloadSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 1 },
  },
  required: ['name'],
  additionalProperties: false,
} satisfies JSONSchema7

export interface UpdateNotebookNameCommand {
  readonly type: 'UpdateNotebookName'
  readonly data: {
    readonly id: string
    readonly name: string
  }
}

export const updateNotebookNamePayloadSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', minLength: 1 },
    name: { type: 'string', minLength: 1 },
  },
  required: ['id', 'name'],
  additionalProperties: false,
} satisfies JSONSchema7

export interface DeleteNotebookCommand {
  readonly type: 'DeleteNotebook'
  readonly data: {
    readonly id: string
  }
}

export const deleteNotebookPayloadSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', minLength: 1 },
  },
  required: ['id'],
  additionalProperties: false,
} satisfies JSONSchema7

export interface AddNotebookTagCommand {
  readonly type: 'AddNotebookTag'
  readonly data: {
    readonly id: string
    readonly tag: string
  }
}

export const addNotebookTagPayloadSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', minLength: 1 },
    tag: { type: 'string', minLength: 1 },
  },
  required: ['id', 'tag'],
  additionalProperties: false,
} satisfies JSONSchema7

export interface RemoveNotebookTagCommand {
  readonly type: 'RemoveNotebookTag'
  readonly data: {
    readonly id: string
    readonly tag: string
  }
}

export const removeNotebookTagPayloadSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', minLength: 1 },
    tag: { type: 'string', minLength: 1 },
  },
  required: ['id', 'tag'],
  additionalProperties: false,
} satisfies JSONSchema7
