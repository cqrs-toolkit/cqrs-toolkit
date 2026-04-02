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

const permitResponseSchema: JSONSchema7 = {
  $id: 'urn:schema:storage.PresignedPermitResponse:1.0.0',
  type: 'object',
  properties: {
    id: { type: 'string' },
    data: {
      type: 'object',
      properties: {
        uploadForm: {
          type: 'object',
          properties: {
            url: { type: 'string' },
            fields: { type: 'object', additionalProperties: { type: 'string' } },
          },
          required: ['url', 'fields'],
        },
      },
      required: ['uploadForm'],
    },
  },
  required: ['id', 'data'],
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
      responseSchema: [{ contentType: 'application/json', schema: permitResponseSchema }],
      workflow: {
        type: 'svc:PresignedPostUpload',
        nextStep: {
          id: 'svc:S3FormPost',
          supportedOperation: [{ method: 'POST', expects: 'multipart/form-data' }],
        },
      },
    }),
    addCommandCapabilitySchema(deleteFileObjectDataSchema, {
      id: 'urn:command:storage.DeleteFileObject:1.0.0',
      stableId: FileObjectCommandIds.DeleteFileObject,
      dispatch: 'command',
      commandType: 'delete',
    }),
  ],
})
