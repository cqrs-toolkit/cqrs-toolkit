/**
 * FileObject v1.0.0 representation — resource, collection, and event surfaces.
 */

import { HydraDoc } from '@cqrs-toolkit/hypermedia'

export const FileObjectRepV1_0_0 = new HydraDoc.Representation({
  id: 'urn:representation:storage.FileObject:1.0.0',
  version: '1.0.0',
  resource: {
    profile: 'urn:profile:storage.FileObject:1.0.0',
    formats: ['application/json', 'application/hal+json'],
    template: {
      id: '#storage-file-object-resource-v1_0_0',
      template: '/api/file-objects/{id}',
      mappings: [{ variable: 'id', property: 'storage:fileObjectId', required: true }],
    },
  },
  collection: {
    profile: 'urn:profile:storage.FileObjectCollection:1.0.0',
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
  },
  events: {
    resourceSegment: 'file-objects',
    baseHref: '/api',
    item: { profile: 'urn:profile:storage.FileObjectItemEvent:1.0.0' },
    aggregate: { profile: 'urn:profile:storage.FileObjectEvent:1.0.0' },
  },
})
