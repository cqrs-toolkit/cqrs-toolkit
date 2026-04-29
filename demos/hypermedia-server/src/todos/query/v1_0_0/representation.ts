/**
 * Todo v1.0.0 representation — resource, collection, and event surfaces.
 */

import { HydraDoc } from '@cqrs-toolkit/hypermedia'
import type { JSONSchema7 } from 'json-schema'
import { halCollectionLinks, halResourceLinks } from '../../../hal-schemas.js'

// ---------------------------------------------------------------------------
// Core schema properties
// ---------------------------------------------------------------------------

const todoProperties = {
  id: { type: 'string' },
  content: { type: 'string' },
  status: { type: 'string', enum: ['pending', 'in_progress', 'completed'] },
  createdAt: { type: 'string' },
  updatedAt: { type: 'string' },
  latestRevision: { type: 'string' },
} satisfies Record<string, JSONSchema7>

const todoRequired = [
  'id',
  'content',
  'status',
  'createdAt',
  'updatedAt',
  'latestRevision',
] as const

// ---------------------------------------------------------------------------
// Response schemas
// ---------------------------------------------------------------------------

const todoResourceJsonSchema: JSONSchema7 = {
  $id: 'urn:schema:nb.Todo:1.0.0',
  type: 'object',
  properties: { ...todoProperties },
  required: [...todoRequired],
}

const todoResourceHalSchema: JSONSchema7 = {
  $id: 'urn:schema:hal:nb.Todo:1.0.0',
  type: 'object',
  properties: {
    ...todoProperties,
    _links: halResourceLinks,
  },
  required: [...todoRequired, '_links'],
}

const todoCollectionJsonSchema: JSONSchema7 = {
  $id: 'urn:schema:nb.TodoCollection:1.0.0',
  type: 'object',
  properties: {
    entities: { type: 'array', items: todoResourceJsonSchema },
    nextCursor: { type: ['string', 'null'] },
    totalItems: { type: 'number' },
  },
  required: ['entities', 'nextCursor'],
}

const todoCollectionHalSchema: JSONSchema7 = {
  $id: 'urn:schema:hal:nb.TodoCollection:1.0.0',
  type: 'object',
  properties: {
    _links: halCollectionLinks,
    _embedded: {
      type: 'object',
      properties: {
        item: { type: 'array', items: todoResourceHalSchema },
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

export const TodoRepV1_0_0 = new HydraDoc.Representation({
  id: 'urn:representation:nb.Todo:1.0.0',
  version: '1.0.0',
  resource: {
    profile: 'urn:profile:nb.Todo:1.0.0',
    operationId: 'getTodoById',
    formats: ['application/json', 'application/hal+json'],
    template: {
      id: '#nb-todo-resource-v1_0_0',
      template: '/api/todos/{id}',
      mappings: [{ variable: 'id', property: 'nb:todoId', required: true }],
    },
    responses: [
      { code: 200, contentType: 'application/json', schema: todoResourceJsonSchema },
      { code: 200, contentType: 'application/hal+json', schema: todoResourceHalSchema },
    ],
  },
  collection: {
    profile: 'urn:profile:nb.TodoCollection:1.0.0',
    operationId: 'getTodos',
    formats: ['application/json', 'application/hal+json'],
    href: '/api/todos',
    template: {
      id: '#nb-todo-collection-v1_0_0',
      template: '/api/todos',
      mappings: [
        { variable: 'cursor', property: 'svc:cursor' },
        { variable: 'limit', property: 'svc:limit' },
      ],
    },
    responses: [
      { code: 200, contentType: 'application/json', schema: todoCollectionJsonSchema },
      { code: 200, contentType: 'application/hal+json', schema: todoCollectionHalSchema },
    ],
  },
  events: {
    resourceSegment: 'todos',
    baseHref: '/api',
    item: {
      id: 'urn:representation:nb.TodoItemEvent:1.0.0',
      profile: 'urn:profile:nb.TodoItemEvent:1.0.0',
    },
    aggregate: {
      id: 'urn:representation:nb.TodoEvent:1.0.0',
      profile: 'urn:profile:nb.TodoEvent:1.0.0',
    },
  },
})
