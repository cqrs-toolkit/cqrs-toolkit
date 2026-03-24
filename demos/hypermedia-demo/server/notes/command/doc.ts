/**
 * Hydra command documentation for the Note entity.
 */

import { createNotePayloadSchema } from '@cqrs-toolkit/demo-base/notes/shared'
import { HydraDoc } from '@cqrs-toolkit/hypermedia'
import type { JSONSchema7 } from 'json-schema'
import { addBodyCommandSchema, addCommandCapabilitySchema } from '../../command-utils.js'

// ---------------------------------------------------------------------------
// Command IDs
// ---------------------------------------------------------------------------

export const NoteCommandIds = {
  CreateNote: 'demo.CreateNote',
  UpdateNoteTitle: 'demo.UpdateNoteTitle',
  UpdateNoteBody: 'demo.UpdateNoteBody',
  DeleteNote: 'demo.DeleteNote',
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

export const NoteCommands = new HydraDoc.CommandsDef<never>({
  surfaces: HydraDoc.standardCommandSurfaces({
    idStem: '#demo-note',
    collectionHref: '/api/notes',
    idProperty: 'demo:noteId',
  }),

  commands: [
    addBodyCommandSchema(createNotePayloadSchema, {
      id: 'urn:command:demo.CreateNote:1.0.0',
      stableId: NoteCommandIds.CreateNote,
      dispatch: 'create',
    }),
    addCommandCapabilitySchema(updateNoteTitleDataSchema, {
      id: 'urn:command:demo.UpdateNoteTitle:1.0.0',
      stableId: NoteCommandIds.UpdateNoteTitle,
      dispatch: 'command',
      commandType: 'updateTitle',
    }),
    addCommandCapabilitySchema(updateNoteBodyDataSchema, {
      id: 'urn:command:demo.UpdateNoteBody:1.0.0',
      stableId: NoteCommandIds.UpdateNoteBody,
      dispatch: 'command',
      commandType: 'updateBody',
    }),
    addCommandCapabilitySchema(deleteNoteDataSchema, {
      id: 'urn:command:demo.DeleteNote:1.0.0',
      stableId: NoteCommandIds.DeleteNote,
      dispatch: 'command',
      commandType: 'delete',
    }),
  ],
})
