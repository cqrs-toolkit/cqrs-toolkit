/**
 * Note v1.0.0 representation — resource, collection, and event surfaces.
 */

import { HydraDoc } from '@cqrs-toolkit/hypermedia'
import type { JSONSchema7 } from 'json-schema'
import { halCollectionLinks, halResourceLinks } from '../../../hal-schemas.js'

// ---------------------------------------------------------------------------
// Core schema properties
// ---------------------------------------------------------------------------

const noteProperties = {
  id: { type: 'string' },
  notebookId: { type: 'string' },
  title: { type: 'string' },
  body: { type: 'string' },
  createdAt: { type: 'string' },
  updatedAt: { type: 'string' },
  latestRevision: { type: 'string' },
} satisfies Record<string, JSONSchema7>

const noteRequired = [
  'id',
  'notebookId',
  'title',
  'body',
  'createdAt',
  'updatedAt',
  'latestRevision',
] as const

// ---------------------------------------------------------------------------
// Response schemas
// ---------------------------------------------------------------------------

const noteResourceJsonSchema: JSONSchema7 = {
  $id: 'urn:schema:nb.Note:1.0.0',
  type: 'object',
  properties: { ...noteProperties },
  required: [...noteRequired],
}

const noteResourceHalSchema: JSONSchema7 = {
  $id: 'urn:schema:hal:nb.Note:1.0.0',
  type: 'object',
  properties: {
    ...noteProperties,
    _links: halResourceLinks,
  },
  required: [...noteRequired, '_links'],
}

const noteCollectionJsonSchema: JSONSchema7 = {
  $id: 'urn:schema:nb.NoteCollection:1.0.0',
  type: 'object',
  properties: {
    entities: { type: 'array', items: noteResourceJsonSchema },
    nextCursor: { type: ['string', 'null'] },
    totalItems: { type: 'number' },
  },
  required: ['entities', 'nextCursor'],
}

const noteCollectionHalSchema: JSONSchema7 = {
  $id: 'urn:schema:hal:nb.NoteCollection:1.0.0',
  type: 'object',
  properties: {
    _links: halCollectionLinks,
    _embedded: {
      type: 'object',
      properties: {
        item: { type: 'array', items: noteResourceHalSchema },
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

export const NoteRepV1_0_0 = new HydraDoc.Representation({
  id: 'urn:representation:nb.Note:1.0.0',
  version: '1.0.0',
  resource: {
    profile: 'urn:profile:nb.Note:1.0.0',
    operationId: 'getNoteById',
    formats: ['application/json', 'application/hal+json'],
    template: {
      id: '#nb-note-resource-v1_0_0',
      template: '/api/notes/{id}',
      mappings: [{ variable: 'id', property: 'nb:noteId', required: true }],
    },
    responses: [
      { code: 200, contentType: 'application/json', schema: noteResourceJsonSchema },
      { code: 200, contentType: 'application/hal+json', schema: noteResourceHalSchema },
    ],
  },
  collection: {
    profile: 'urn:profile:nb.NoteCollection:1.0.0',
    operationId: 'getNotes',
    formats: ['application/json', 'application/hal+json'],
    href: '/api/notes',
    template: {
      id: '#nb-note-collection-v1_0_0',
      template: '/api/notes',
      mappings: [
        { variable: 'cursor', property: 'svc:cursor' },
        { variable: 'limit', property: 'svc:limit' },
      ],
    },
    responses: [
      { code: 200, contentType: 'application/json', schema: noteCollectionJsonSchema },
      { code: 200, contentType: 'application/hal+json', schema: noteCollectionHalSchema },
    ],
  },
  events: {
    resourceSegment: 'notes',
    baseHref: '/api',
    item: { profile: 'urn:profile:nb.NoteItemEvent:1.0.0' },
    aggregate: { profile: 'urn:profile:nb.NoteEvent:1.0.0' },
  },
})
