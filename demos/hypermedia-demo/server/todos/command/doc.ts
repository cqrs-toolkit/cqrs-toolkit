/**
 * Hydra command documentation for the Todo entity.
 */

import { createTodoPayloadSchema } from '@cqrs-toolkit/demo-base/todos/shared'
import { HydraDoc } from '@cqrs-toolkit/hypermedia'
import type { JSONSchema7 } from 'json-schema'
import { addBodyCommandSchema, addCommandCapabilitySchema } from '../../command-utils.js'

// ---------------------------------------------------------------------------
// Command IDs
// ---------------------------------------------------------------------------

export const TodoCommandIds = {
  CreateTodo: 'nb.CreateTodo',
  UpdateTodoContent: 'nb.UpdateTodoContent',
  ChangeTodoStatus: 'nb.ChangeTodoStatus',
  DeleteTodo: 'nb.DeleteTodo',
} as const

// ---------------------------------------------------------------------------
// Data-only schemas for command envelope (no id/revision — those go in URL/envelope)
// ---------------------------------------------------------------------------

const updateTodoContentDataSchema: JSONSchema7 = {
  type: 'object',
  properties: {
    content: { type: 'string', minLength: 1 },
  },
  required: ['content'],
  additionalProperties: false,
}

const changeTodoStatusDataSchema: JSONSchema7 = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['pending', 'in_progress', 'completed'] },
  },
  required: ['status'],
  additionalProperties: false,
}

const deleteTodoDataSchema: JSONSchema7 = {
  type: 'object',
  properties: {},
  additionalProperties: false,
}

// ---------------------------------------------------------------------------
// CommandsDef
// ---------------------------------------------------------------------------

export const TodoCommands = new HydraDoc.CommandsDef<never>({
  surfaces: HydraDoc.standardCommandSurfaces({
    idStem: '#nb-todo',
    collectionHref: '/api/todos',
    idProperty: 'nb:todoId',
  }),

  commands: [
    addBodyCommandSchema(createTodoPayloadSchema, {
      id: 'urn:command:nb.CreateTodo:1.0.0',
      stableId: TodoCommandIds.CreateTodo,
      dispatch: 'create',
    }),
    addCommandCapabilitySchema(updateTodoContentDataSchema, {
      id: 'urn:command:nb.UpdateTodoContent:1.0.0',
      stableId: TodoCommandIds.UpdateTodoContent,
      dispatch: 'command',
      commandType: 'updateContent',
    }),
    addCommandCapabilitySchema(changeTodoStatusDataSchema, {
      id: 'urn:command:nb.ChangeTodoStatus:1.0.0',
      stableId: TodoCommandIds.ChangeTodoStatus,
      dispatch: 'command',
      commandType: 'changeStatus',
    }),
    addCommandCapabilitySchema(deleteTodoDataSchema, {
      id: 'urn:command:nb.DeleteTodo:1.0.0',
      stableId: TodoCommandIds.DeleteTodo,
      dispatch: 'command',
      commandType: 'delete',
    }),
  ],
})
