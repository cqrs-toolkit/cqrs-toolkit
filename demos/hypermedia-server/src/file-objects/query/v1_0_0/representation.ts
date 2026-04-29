/**
 * FileObject v1.0.0 representation — resource, collection, and event surfaces.
 */

import { HydraDoc } from '@cqrs-toolkit/hypermedia'
import type { JSONSchema7 } from 'json-schema'
import { halCollectionLinks, halResourceLinks } from '../../../hal-schemas.js'

// ---------------------------------------------------------------------------
// Core schema properties
// ---------------------------------------------------------------------------

const fileObjectProperties = {
  id: { type: 'string' },
  noteId: { type: 'string' },
  notebookId: { type: 'string' },
  name: { type: 'string' },
  contentType: { type: 'string' },
  resource: { type: 'string' },
  size: { type: 'number' },
  createdAt: { type: 'string' },
  latestRevision: { type: 'string' },
} satisfies Record<string, JSONSchema7>

const fileObjectRequired = [
  'id',
  'noteId',
  'notebookId',
  'name',
  'contentType',
  'resource',
  'size',
  'createdAt',
  'latestRevision',
] as const

// ---------------------------------------------------------------------------
// Response schemas
// ---------------------------------------------------------------------------

const fileObjectResourceJsonSchema: JSONSchema7 = {
  $id: 'urn:schema:storage.FileObject:1.0.0',
  type: 'object',
  properties: { ...fileObjectProperties },
  required: [...fileObjectRequired],
}

const fileObjectResourceHalSchema: JSONSchema7 = {
  $id: 'urn:schema:hal:storage.FileObject:1.0.0',
  type: 'object',
  properties: {
    ...fileObjectProperties,
    _links: halResourceLinks,
  },
  required: [...fileObjectRequired, '_links'],
}

const fileObjectCollectionJsonSchema: JSONSchema7 = {
  $id: 'urn:schema:storage.FileObjectCollection:1.0.0',
  type: 'object',
  properties: {
    entities: { type: 'array', items: fileObjectResourceJsonSchema },
    nextCursor: { type: ['string', 'null'] },
    totalItems: { type: 'number' },
  },
  required: ['entities', 'nextCursor'],
}

const fileObjectCollectionHalSchema: JSONSchema7 = {
  $id: 'urn:schema:hal:storage.FileObjectCollection:1.0.0',
  type: 'object',
  properties: {
    _links: halCollectionLinks,
    _embedded: {
      type: 'object',
      properties: {
        item: { type: 'array', items: fileObjectResourceHalSchema },
      },
      required: ['item'],
    },
    totalItems: { type: 'number' },
  },
  required: ['_links', '_embedded'],
}

// ---------------------------------------------------------------------------
// Representation
// ---------------------------------------------------------------------------

export const FileObjectRepV1_0_0 = new HydraDoc.Representation({
  id: 'urn:representation:storage.FileObject:1.0.0',
  version: '1.0.0',
  resource: {
    profile: 'urn:profile:storage.FileObject:1.0.0',
    operationId: 'getFileObjectById',
    formats: ['application/json', 'application/hal+json'],
    template: {
      id: '#storage-file-object-resource-v1_0_0',
      template: '/api/file-objects/{id}',
      mappings: [{ variable: 'id', property: 'storage:fileObjectId', required: true }],
    },
    responses: [
      { code: 200, contentType: 'application/json', schema: fileObjectResourceJsonSchema },
      { code: 200, contentType: 'application/hal+json', schema: fileObjectResourceHalSchema },
    ],
  },
  collection: {
    profile: 'urn:profile:storage.FileObjectCollection:1.0.0',
    operationId: 'getFileObjects',
    formats: ['application/json', 'application/hal+json'],
    href: '/api/file-objects',
    template: {
      id: '#storage-file-object-collection-v1_0_0',
      template: '/api/file-objects',
      mappings: [
        { variable: 'cursor', property: 'svc:cursor' },
        { variable: 'limit', property: 'svc:limit' },
        { variable: 'noteId', property: 'nb:noteId' },
      ],
    },
    responses: [
      { code: 200, contentType: 'application/json', schema: fileObjectCollectionJsonSchema },
      { code: 200, contentType: 'application/hal+json', schema: fileObjectCollectionHalSchema },
    ],
  },
  events: {
    resourceSegment: 'file-objects',
    baseHref: '/api',
    item: {
      id: 'urn:representation:storage.FileObjectItemEvent:1.0.0',
      profile: 'urn:profile:storage.FileObjectItemEvent:1.0.0',
      operationId: 'getFileObjectEventsById',
    },
    aggregate: {
      id: 'urn:representation:storage.FileObjectEvent:1.0.0',
      profile: 'urn:profile:storage.FileObjectEvent:1.0.0',
      operationId: 'getFileObjectEvents',
    },
  },
})
