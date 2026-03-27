/**
 * Hydra command documentation for the Notebook entity.
 */

import { createNotebookPayloadSchema } from '@cqrs-toolkit/demo-base/notebooks/shared'
import { HydraDoc } from '@cqrs-toolkit/hypermedia'
import type { JSONSchema7 } from 'json-schema'
import { addBodyCommandSchema, addCommandCapabilitySchema } from '../../command-utils.js'

// ---------------------------------------------------------------------------
// Command IDs
// ---------------------------------------------------------------------------

export const NotebookCommandIds = {
  CreateNotebook: 'demo.CreateNotebook',
  UpdateNotebookName: 'demo.UpdateNotebookName',
  DeleteNotebook: 'demo.DeleteNotebook',
  AddNotebookTag: 'demo.AddNotebookTag',
  RemoveNotebookTag: 'demo.RemoveNotebookTag',
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

export const NotebookCommands = new HydraDoc.CommandsDef<never>({
  surfaces: HydraDoc.standardCommandSurfaces({
    idStem: '#demo-notebook',
    collectionHref: '/api/notebooks',
    idProperty: 'demo:notebookId',
  }),

  commands: [
    addBodyCommandSchema(createNotebookPayloadSchema, {
      id: 'urn:command:demo.CreateNotebook:1.0.0',
      stableId: NotebookCommandIds.CreateNotebook,
      dispatch: 'create',
    }),
    addCommandCapabilitySchema(updateNotebookNameDataSchema, {
      id: 'urn:command:demo.UpdateNotebookName:1.0.0',
      stableId: NotebookCommandIds.UpdateNotebookName,
      dispatch: 'command',
      commandType: 'updateName',
    }),
    addCommandCapabilitySchema(deleteNotebookDataSchema, {
      id: 'urn:command:demo.DeleteNotebook:1.0.0',
      stableId: NotebookCommandIds.DeleteNotebook,
      dispatch: 'command',
      commandType: 'delete',
    }),
    addCommandCapabilitySchema(addNotebookTagDataSchema, {
      id: 'urn:command:demo.AddNotebookTag:1.0.0',
      stableId: NotebookCommandIds.AddNotebookTag,
      dispatch: 'command',
      commandType: 'addTag',
    }),
    addCommandCapabilitySchema(removeNotebookTagDataSchema, {
      id: 'urn:command:demo.RemoveNotebookTag:1.0.0',
      stableId: NotebookCommandIds.RemoveNotebookTag,
      dispatch: 'command',
      commandType: 'removeTag',
    }),
  ],
})
