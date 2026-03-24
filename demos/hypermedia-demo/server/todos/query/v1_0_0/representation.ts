/**
 * Todo v1.0.0 representation — resource, collection, and event surfaces.
 */

import { HydraDoc } from '@cqrs-toolkit/hypermedia'

export const TodoRepV1_0_0 = new HydraDoc.Representation({
  id: '#demo-todo-v1_0_0',
  version: '1.0.0',
  resource: {
    profile: 'urn:profile:demo.Todo:1.0.0',
    formats: ['application/json', 'application/hal+json'],
    template: {
      id: '#demo-todo-resource-v1_0_0',
      template: '/api/todos/{id}',
      mappings: [{ variable: 'id', property: 'demo:todoId', required: true }],
    },
  },
  collection: {
    profile: 'urn:profile:demo.TodoCollection:1.0.0',
    formats: ['application/json', 'application/hal+json'],
    href: '/api/todos',
    template: {
      id: '#demo-todo-collection-v1_0_0',
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
    item: { profile: 'urn:profile:demo.TodoItemEvent:1.0.0' },
    aggregate: { profile: 'urn:profile:demo.TodoEvent:1.0.0' },
  },
})
