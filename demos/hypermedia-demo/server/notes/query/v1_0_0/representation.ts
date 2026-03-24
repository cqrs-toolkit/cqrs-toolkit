/**
 * Note v1.0.0 representation — resource, collection, and event surfaces.
 */

import { HydraDoc } from '@cqrs-toolkit/hypermedia'

export const NoteRepV1_0_0 = new HydraDoc.Representation({
  id: '#demo-note-v1_0_0',
  version: '1.0.0',
  resource: {
    profile: 'urn:profile:demo.Note:1.0.0',
    formats: ['application/json', 'application/hal+json'],
    template: {
      id: '#demo-note-resource-v1_0_0',
      template: '/api/notes/{id}',
      mappings: [{ variable: 'id', property: 'demo:noteId', required: true }],
    },
  },
  collection: {
    profile: 'urn:profile:demo.NoteCollection:1.0.0',
    formats: ['application/json', 'application/hal+json'],
    href: '/api/notes',
    template: {
      id: '#demo-note-collection-v1_0_0',
      template: '/api/notes',
      mappings: [
        { variable: 'cursor', property: 'svc:cursor' },
        { variable: 'limit', property: 'svc:limit' },
      ],
    },
  },
  events: {
    resourceSegment: 'notes',
    baseHref: '/api',
    item: { profile: 'urn:profile:demo.NoteItemEvent:1.0.0' },
    aggregate: { profile: 'urn:profile:demo.NoteEvent:1.0.0' },
  },
})
