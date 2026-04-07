/**
 * Hydra command documentation for the Note entity.
 */

import { createNotePayloadSchema } from '@cqrs-toolkit/demo-base/notes/shared'
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

export const NoteCommandIds = {
  CreateNote: 'nb.CreateNote',
  UpdateNoteTitle: 'nb.UpdateNoteTitle',
  UpdateNoteBody: 'nb.UpdateNoteBody',
  DeleteNote: 'nb.DeleteNote',
} as const

// ---------------------------------------------------------------------------
// Data-only schemas for command envelope
// ---------------------------------------------------------------------------

const updateNoteTitleDataSchema: JSONSchema7 = {
  type: 'object',
  properties: {
    title: { type: 'string', minLength: 1 },
  },
  required: ['title'],
  additionalProperties: false,
}

const updateNoteBodyDataSchema: JSONSchema7 = {
  type: 'object',
  properties: {
    body: { type: 'string' },
  },
  required: ['body'],
  additionalProperties: false,
}

const deleteNoteDataSchema: JSONSchema7 = {
  type: 'object',
  properties: {},
  additionalProperties: false,
}

// ---------------------------------------------------------------------------
// CommandsDef
// ---------------------------------------------------------------------------

const opts = {
  idStem: '#nb-note',
  collectionHref: '/api/notes',
} satisfies HydraDoc.StandardCreateCommandSurfaceOpts

export const NoteCommands = new HydraDoc.CommandsDef<never>({
  surfaces: [
    HydraDoc.standardCreateCommandSurface({
      ...opts,
      operationId: 'createNote',
      responses: [
        { code: 200, contentType: 'application/json', schema: commandSuccessResponseSchema },
      ],
    }),
    HydraDoc.standardCommandSurface({
      ...opts,
      idProperty: 'nb:noteId',
      operationId: 'postNoteCommand',
      responses: [
        { code: 200, contentType: 'application/json', schema: commandSuccessResponseSchema },
      ],
    }),
  ],

  commands: [
    addBodyCommandSchema(createNotePayloadSchema, {
      id: 'urn:command:nb.CreateNote:1.0.0',
      stableId: NoteCommandIds.CreateNote,
      dispatch: 'create',
    }),
    addCommandCapabilitySchema(updateNoteTitleDataSchema, {
      id: 'urn:command:nb.UpdateNoteTitle:1.0.0',
      stableId: NoteCommandIds.UpdateNoteTitle,
      dispatch: 'command',
      commandType: 'updateTitle',
    }),
    addCommandCapabilitySchema(updateNoteBodyDataSchema, {
      id: 'urn:command:nb.UpdateNoteBody:1.0.0',
      stableId: NoteCommandIds.UpdateNoteBody,
      dispatch: 'command',
      commandType: 'updateBody',
    }),
    addCommandCapabilitySchema(deleteNoteDataSchema, {
      id: 'urn:command:nb.DeleteNote:1.0.0',
      stableId: NoteCommandIds.DeleteNote,
      dispatch: 'command',
      commandType: 'delete',
    }),
  ],
})
