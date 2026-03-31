/**
 * Todo v1.0.0 representation — resource, collection, and event surfaces.
 */

import { HydraDoc } from '@cqrs-toolkit/hypermedia'

export const TodoRepV1_0_0 = new HydraDoc.Representation({
  id: 'urn:representation:nb.Todo:1.0.0',
  version: '1.0.0',
  resource: {
    profile: 'urn:profile:nb.Todo:1.0.0',
    formats: ['application/json', 'application/hal+json'],
    template: {
      id: '#nb-todo-resource-v1_0_0',
      template: '/api/todos/{id}',
      mappings: [{ variable: 'id', property: 'nb:todoId', required: true }],
    },
  },
  collection: {
    profile: 'urn:profile:nb.TodoCollection:1.0.0',
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
  },
  events: {
    resourceSegment: 'todos',
    baseHref: '/api',
    item: { profile: 'urn:profile:nb.TodoItemEvent:1.0.0' },
    aggregate: { profile: 'urn:profile:nb.TodoEvent:1.0.0' },
  },
})
