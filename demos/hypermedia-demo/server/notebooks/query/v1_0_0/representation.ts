/**
 * Notebook v1.0.0 representation — resource, collection, and event surfaces.
 */

import { HydraDoc } from '@cqrs-toolkit/hypermedia'

export const NotebookRepV1_0_0 = new HydraDoc.Representation({
  id: '#demo-notebook-v1_0_0',
  version: '1.0.0',
  resource: {
    profile: 'urn:profile:demo.Notebook:1.0.0',
    formats: ['application/json', 'application/hal+json'],
    template: {
      id: '#demo-notebook-resource-v1_0_0',
      template: '/api/notebooks/{id}',
      mappings: [{ variable: 'id', property: 'demo:notebookId', required: true }],
    },
  },
  collection: {
    profile: 'urn:profile:demo.NotebookCollection:1.0.0',
    formats: ['application/json', 'application/hal+json'],
    href: '/api/notebooks',
    template: {
      id: '#demo-notebook-collection-v1_0_0',
      template: '/api/notebooks',
      mappings: [
        { variable: 'cursor', property: 'svc:cursor' },
        { variable: 'limit', property: 'svc:limit' },
      ],
    },
  },
  events: {
    resourceSegment: 'notebooks',
    baseHref: '/api',
    item: { profile: 'urn:profile:demo.NotebookItemEvent:1.0.0' },
    aggregate: { profile: 'urn:profile:demo.NotebookEvent:1.0.0' },
  },
})
