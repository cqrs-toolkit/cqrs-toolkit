/**
 * Notebook v1.0.0 representation — resource, collection, and event surfaces.
 */

import { HydraDoc } from '@cqrs-toolkit/hypermedia'
import type { JSONSchema7 } from 'json-schema'
import { halCollectionLinks, halResourceLinks } from '../../../hal-schemas.js'

// ---------------------------------------------------------------------------
// Core schema properties
// ---------------------------------------------------------------------------

const notebookProperties = {
  id: { type: 'string' },
  name: { type: 'string' },
  tags: { type: 'array', items: { type: 'string' } },
  createdAt: { type: 'string' },
  updatedAt: { type: 'string' },
  latestRevision: { type: 'string' },
} satisfies Record<string, JSONSchema7>

const notebookRequired = ['id', 'name', 'tags', 'createdAt', 'updatedAt', 'latestRevision'] as const

// ---------------------------------------------------------------------------
// Response schemas
// ---------------------------------------------------------------------------

const notebookResourceJsonSchema: JSONSchema7 = {
  $id: 'urn:schema:nb.Notebook:1.0.0',
  type: 'object',
  properties: { ...notebookProperties },
  required: [...notebookRequired],
}

const notebookResourceHalSchema: JSONSchema7 = {
  $id: 'urn:schema:hal:nb.Notebook:1.0.0',
  type: 'object',
  properties: {
    ...notebookProperties,
    _links: halResourceLinks,
  },
  required: [...notebookRequired, '_links'],
}

const notebookCollectionJsonSchema: JSONSchema7 = {
  $id: 'urn:schema:nb.NotebookCollection:1.0.0',
  type: 'object',
  properties: {
    entities: { type: 'array', items: notebookResourceJsonSchema },
    nextCursor: { type: ['string', 'null'] },
    totalItems: { type: 'number' },
  },
  required: ['entities', 'nextCursor'],
}

const notebookCollectionHalSchema: JSONSchema7 = {
  $id: 'urn:schema:hal:nb.NotebookCollection:1.0.0',
  type: 'object',
  properties: {
    _links: halCollectionLinks,
    _embedded: {
      type: 'object',
      properties: {
        item: { type: 'array', items: notebookResourceHalSchema },
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

export const NotebookRepV1_0_0 = new HydraDoc.Representation({
  id: 'urn:representation:nb.Notebook:1.0.0',
  version: '1.0.0',
  resource: {
    profile: 'urn:profile:nb.Notebook:1.0.0',
    operationId: 'getNotebookById',
    formats: ['application/json', 'application/hal+json'],
    template: {
      id: '#nb-notebook-resource-v1_0_0',
      template: '/api/notebooks/{id}',
      mappings: [{ variable: 'id', property: 'nb:notebookId', required: true }],
    },
    responses: [
      { code: 200, contentType: 'application/json', schema: notebookResourceJsonSchema },
      { code: 200, contentType: 'application/hal+json', schema: notebookResourceHalSchema },
    ],
  },
  collection: {
    profile: 'urn:profile:nb.NotebookCollection:1.0.0',
    operationId: 'getNotebooks',
    formats: ['application/json', 'application/hal+json'],
    href: '/api/notebooks',
    template: {
      id: '#nb-notebook-collection-v1_0_0',
      template: '/api/notebooks',
      mappings: [
        { variable: 'cursor', property: 'svc:cursor' },
        { variable: 'limit', property: 'svc:limit' },
      ],
    },
    responses: [
      { code: 200, contentType: 'application/json', schema: notebookCollectionJsonSchema },
      { code: 200, contentType: 'application/hal+json', schema: notebookCollectionHalSchema },
    ],
  },
  events: {
    resourceSegment: 'notebooks',
    baseHref: '/api',
    item: {
      id: 'urn:representation:nb.NotebookItemEvent:1.0.0',
      profile: 'urn:profile:nb.NotebookItemEvent:1.0.0',
    },
    aggregate: {
      id: 'urn:representation:nb.NotebookEvent:1.0.0',
      profile: 'urn:profile:nb.NotebookEvent:1.0.0',
    },
  },
})
