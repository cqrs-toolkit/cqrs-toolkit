/**
 * Notebook v1.0.0 representation — resource, collection, and event surfaces.
 */

import { HydraDoc } from '@cqrs-toolkit/hypermedia'

export const NotebookRepV1_0_0 = new HydraDoc.Representation({
  id: 'urn:representation:nb.Notebook:1.0.0',
  version: '1.0.0',
  resource: {
    profile: 'urn:profile:nb.Notebook:1.0.0',
    formats: ['application/json', 'application/hal+json'],
    template: {
      id: '#nb-notebook-resource-v1_0_0',
      template: '/api/notebooks/{id}',
      mappings: [{ variable: 'id', property: 'nb:notebookId', required: true }],
    },
  },
  collection: {
    profile: 'urn:profile:nb.NotebookCollection:1.0.0',
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
  },
  events: {
    resourceSegment: 'notebooks',
    baseHref: '/api',
    item: { profile: 'urn:profile:nb.NotebookItemEvent:1.0.0' },
    aggregate: { profile: 'urn:profile:nb.NotebookEvent:1.0.0' },
  },
})
