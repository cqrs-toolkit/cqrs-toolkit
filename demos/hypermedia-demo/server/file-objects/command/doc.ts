/**
 * Hydra command documentation for the FileObject entity.
 */

import { HydraDoc } from '@cqrs-toolkit/hypermedia'
import type { JSONSchema7 } from 'json-schema'
import { addBodyCommandSchema, addCommandCapabilitySchema } from '../../command-utils.js'

// ---------------------------------------------------------------------------
// Command IDs
// ---------------------------------------------------------------------------

export const FileObjectCommandIds = {
  CreateFileObject: 'storage.CreateFileObject',
  DeleteFileObject: 'storage.DeleteFileObject',
} as const

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

/**
 * Permit request schema — noteId, filename, and size are required to build
 * the presigned upload form.
 */
const createFileObjectPermitSchema: JSONSchema7 = {
  type: 'object',
  properties: {
    noteId: { type: 'string', minLength: 1 },
    filename: { type: 'string', minLength: 1 },
    size: { type: 'number', exclusiveMinimum: 0 },
  },
  required: ['noteId', 'filename', 'size'],
  additionalProperties: false,
}

const deleteFileObjectDataSchema: JSONSchema7 = {
  type: 'object',
  properties: {},
  additionalProperties: false,
}

// ---------------------------------------------------------------------------
// CommandsDef
// ---------------------------------------------------------------------------

export const FileObjectCommands = new HydraDoc.CommandsDef<never>({
  surfaces: HydraDoc.standardCommandSurfaces({
    idStem: '#storage-file-object',
    collectionHref: '/api/file-objects',
    idProperty: 'storage:fileObjectId',
  }),

  commands: [
    addBodyCommandSchema(createFileObjectPermitSchema, {
      id: 'urn:command:storage.CreateFileObject:1.0.0',
      stableId: FileObjectCommandIds.CreateFileObject,
      dispatch: 'create',
    }),
    addCommandCapabilitySchema(deleteFileObjectDataSchema, {
      id: 'urn:command:storage.DeleteFileObject:1.0.0',
      stableId: FileObjectCommandIds.DeleteFileObject,
      dispatch: 'command',
      commandType: 'delete',
    }),
  ],
})
