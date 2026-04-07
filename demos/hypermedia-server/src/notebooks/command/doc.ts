/**
 * Hydra command documentation for the Notebook entity.
 */

import { createNotebookPayloadSchema } from '@cqrs-toolkit/demo-base/notebooks/shared'
import { HydraDoc } from '@cqrs-toolkit/hypermedia'
import type { JSONSchema7 } from 'json-schema'
import {
  addBodyCommandSchema,
  addCommandCapabilitySchema,
  commandSuccessResponseSchema,
} from '../../command-utils.js'

// ---------------------------------------------------------------------------
// Command IDs
// ---------------------------------------------------------------------------

export const NotebookCommandIds = {
  CreateNotebook: 'nb.CreateNotebook',
  UpdateNotebookName: 'nb.UpdateNotebookName',
  DeleteNotebook: 'nb.DeleteNotebook',
  AddNotebookTag: 'nb.AddNotebookTag',
  RemoveNotebookTag: 'nb.RemoveNotebookTag',
} as const

// ---------------------------------------------------------------------------
// Data-only schemas for command envelope
// ---------------------------------------------------------------------------

const updateNotebookNameDataSchema: JSONSchema7 = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 1 },
  },
  required: ['name'],
  additionalProperties: false,
}

const deleteNotebookDataSchema: JSONSchema7 = {
  type: 'object',
  properties: {},
  additionalProperties: false,
}

const addNotebookTagDataSchema: JSONSchema7 = {
  type: 'object',
  properties: {
    tag: { type: 'string', minLength: 1 },
  },
  required: ['tag'],
  additionalProperties: false,
}

const removeNotebookTagDataSchema: JSONSchema7 = {
  type: 'object',
  properties: {
    tag: { type: 'string', minLength: 1 },
  },
  required: ['tag'],
  additionalProperties: false,
}

// ---------------------------------------------------------------------------
// CommandsDef
// ---------------------------------------------------------------------------

const opts = {
  idStem: '#nb-notebook',
  collectionHref: '/api/notebooks',
} satisfies HydraDoc.StandardCreateCommandSurfaceOpts

export const NotebookCommands = new HydraDoc.CommandsDef<never>({
  surfaces: [
    HydraDoc.standardCreateCommandSurface({
      ...opts,
      operationId: 'createNotebook',
      responses: [
        { code: 200, contentType: 'application/json', schema: commandSuccessResponseSchema },
      ],
    }),
    HydraDoc.standardCommandSurface({
      ...opts,
      idProperty: 'nb:notebookId',
      operationId: 'postNotebookCommand',
      responses: [
        { code: 200, contentType: 'application/json', schema: commandSuccessResponseSchema },
      ],
    }),
  ],

  commands: [
    addBodyCommandSchema(createNotebookPayloadSchema, {
      id: 'urn:command:nb.CreateNotebook:1.0.0',
      stableId: NotebookCommandIds.CreateNotebook,
      dispatch: 'create',
    }),
    addCommandCapabilitySchema(updateNotebookNameDataSchema, {
      id: 'urn:command:nb.UpdateNotebookName:1.0.0',
      stableId: NotebookCommandIds.UpdateNotebookName,
      dispatch: 'command',
      commandType: 'updateName',
    }),
    addCommandCapabilitySchema(deleteNotebookDataSchema, {
      id: 'urn:command:nb.DeleteNotebook:1.0.0',
      stableId: NotebookCommandIds.DeleteNotebook,
      dispatch: 'command',
      commandType: 'delete',
    }),
    addCommandCapabilitySchema(addNotebookTagDataSchema, {
      id: 'urn:command:nb.AddNotebookTag:1.0.0',
      stableId: NotebookCommandIds.AddNotebookTag,
      dispatch: 'command',
      commandType: 'addTag',
    }),
    addCommandCapabilitySchema(removeNotebookTagDataSchema, {
      id: 'urn:command:nb.RemoveNotebookTag:1.0.0',
      stableId: NotebookCommandIds.RemoveNotebookTag,
      dispatch: 'command',
      commandType: 'removeTag',
    }),
  ],
})
