/**
 * Note v1.0.0 representation — resource, collection, and event surfaces.
 */

import { HydraDoc } from '@cqrs-toolkit/hypermedia'

export const NoteRepV1_0_0 = new HydraDoc.Representation({
  id: 'urn:representation:nb.Note:1.0.0',
  version: '1.0.0',
  resource: {
    profile: 'urn:profile:nb.Note:1.0.0',
    formats: ['application/json', 'application/hal+json'],
    template: {
      id: '#nb-note-resource-v1_0_0',
      template: '/api/notes/{id}',
      mappings: [{ variable: 'id', property: 'nb:noteId', required: true }],
    },
  },
  collection: {
    profile: 'urn:profile:nb.NoteCollection:1.0.0',
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
  },
  events: {
    resourceSegment: 'notes',
    baseHref: '/api',
    item: { profile: 'urn:profile:nb.NoteItemEvent:1.0.0' },
    aggregate: { profile: 'urn:profile:nb.NoteEvent:1.0.0' },
  },
})
