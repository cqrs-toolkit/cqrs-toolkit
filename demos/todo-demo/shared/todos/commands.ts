/**
 * Todo command types, command union, and ajv validation schemas.
 */

import type { JSONSchemaType } from 'ajv'
import type { TodoStatus } from './types.js'

export type TodoCommandType = 'CreateTodo' | 'UpdateTodoContent' | 'ChangeTodoStatus' | 'DeleteTodo'

export type TodoCommand =
  | CreateTodoCommand
  | UpdateTodoContentCommand
  | ChangeTodoStatusCommand
  | DeleteTodoCommand

export interface CreateTodoCommand {
  readonly type: 'CreateTodo'
  readonly payload: {
    readonly content: string
  }
}

export interface UpdateTodoContentCommand {
  readonly type: 'UpdateTodoContent'
  readonly payload: {
    readonly id: string
    readonly content: string
    readonly revision: string
  }
}

export interface ChangeTodoStatusCommand {
  readonly type: 'ChangeTodoStatus'
  readonly payload: {
    readonly id: string
    readonly status: TodoStatus
    readonly revision: string
  }
}

export interface DeleteTodoCommand {
  readonly type: 'DeleteTodo'
  readonly payload: {
    readonly id: string
    readonly revision: string
  }
}

// --- ajv schemas for command payloads ---

export const createTodoPayloadSchema: JSONSchemaType<CreateTodoCommand['payload']> = {
  type: 'object',
  properties: {
    content: { type: 'string', minLength: 1 },
  },
  required: ['content'],
  additionalProperties: false,
}

export const updateTodoContentPayloadSchema: JSONSchemaType<UpdateTodoContentCommand['payload']> = {
  type: 'object',
  properties: {
    id: { type: 'string', minLength: 1 },
    content: { type: 'string', minLength: 1 },
    revision: { type: 'string', minLength: 1 },
  },
  required: ['id', 'content', 'revision'],
  additionalProperties: false,
}

export const changeTodoStatusPayloadSchema: JSONSchemaType<ChangeTodoStatusCommand['payload']> = {
  type: 'object',
  properties: {
    id: { type: 'string', minLength: 1 },
    status: { type: 'string', enum: ['pending', 'in_progress', 'completed'] },
    revision: { type: 'string', minLength: 1 },
  },
  required: ['id', 'status', 'revision'],
  additionalProperties: false,
}

export const deleteTodoPayloadSchema: JSONSchemaType<DeleteTodoCommand['payload']> = {
  type: 'object',
  properties: {
    id: { type: 'string', minLength: 1 },
    revision: { type: 'string', minLength: 1 },
  },
  required: ['id', 'revision'],
  additionalProperties: false,
}
