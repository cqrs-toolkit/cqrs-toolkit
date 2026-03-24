/**
 * Todo command types, command union, and validation schemas.
 */

import type { JSONSchema7 } from 'json-schema'
import type { TodoStatus } from './types.js'

export type TodoCommandType = 'CreateTodo' | 'UpdateTodoContent' | 'ChangeTodoStatus' | 'DeleteTodo'

export type TodoCommand =
  | CreateTodoCommand
  | UpdateTodoContentCommand
  | ChangeTodoStatusCommand
  | DeleteTodoCommand

export interface CreateTodoCommand {
  readonly type: 'CreateTodo'
  readonly data: {
    readonly content: string
  }
}

export const createTodoPayloadSchema = {
  type: 'object',
  properties: {
    content: { type: 'string', minLength: 1 },
  },
  required: ['content'],
  additionalProperties: false,
} satisfies JSONSchema7

export interface UpdateTodoContentCommand {
  readonly type: 'UpdateTodoContent'
  readonly data: {
    readonly id: string
    readonly content: string
  }
}

export const updateTodoContentPayloadSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', minLength: 1 },
    content: { type: 'string', minLength: 1 },
  },
  required: ['id', 'content'],
  additionalProperties: false,
} satisfies JSONSchema7

export interface ChangeTodoStatusCommand {
  readonly type: 'ChangeTodoStatus'
  readonly data: {
    readonly id: string
    readonly status: TodoStatus
  }
}

export const changeTodoStatusPayloadSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', minLength: 1 },
    status: { type: 'string', enum: ['pending', 'in_progress', 'completed'] },
  },
  required: ['id', 'status'],
  additionalProperties: false,
} satisfies JSONSchema7

export interface DeleteTodoCommand {
  readonly type: 'DeleteTodo'
  readonly data: {
    readonly id: string
  }
}

export const deleteTodoPayloadSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', minLength: 1 },
  },
  required: ['id'],
  additionalProperties: false,
} satisfies JSONSchema7
