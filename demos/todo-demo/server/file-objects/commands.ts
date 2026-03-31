/**
 * FileObject command types and ajv validation schemas for the todo-demo.
 *
 * These are specific to the todo-demo's direct multipart upload pattern.
 * The hypermedia-demo uses a permit-based pattern with its own schemas
 * defined in the Hydra command documentation layer.
 */

import type { JSONSchema7 } from 'json-schema'

export type FileObjectCommandType = 'CreateFileObject' | 'DeleteFileObject'

export type FileObjectCommand = CreateFileObjectCommand | DeleteFileObjectCommand

export interface CreateFileObjectCommand {
  readonly type: 'CreateFileObject'
  readonly data: {
    readonly noteId: string
  }
}

export const createFileObjectPayloadSchema = {
  type: 'object',
  properties: {
    noteId: { type: 'string', minLength: 1 },
  },
  required: ['noteId'],
  additionalProperties: false,
} satisfies JSONSchema7

export interface DeleteFileObjectCommand {
  readonly type: 'DeleteFileObject'
  readonly data: {
    readonly id: string
  }
}

export const deleteFileObjectPayloadSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', minLength: 1 },
  },
  required: ['id'],
  additionalProperties: false,
} satisfies JSONSchema7
