/**
 * Generated representation surfaces — do not edit.
 * Regenerate with: cqrs-toolkit client pull
 */

import type { RepresentationSurfaces } from '@cqrs-toolkit/hypermedia-client'

interface Representations {
  'nb:Todo': RepresentationSurfaces
  'nb:Note': RepresentationSurfaces
  'nb:Notebook': RepresentationSurfaces
  'storage:FileObject': RepresentationSurfaces
}

export const representations: Representations = {
  'nb:Todo': {
    urn: 'urn:representation:nb.Todo:1.0.0',
    version: '1.0.0',
    collection: { href: '/api/todos', template: '/api/todos{?cursor,limit}' },
    resource: { template: '/api/todos/{id}' },
    itemEvents: {
      href: '/api/todos/{id}/events',
      template: '/api/todos/{id}/events{?limit,afterPosition}',
    },
    aggregateEvents: {
      href: '/api/events/todos',
      template: '/api/events/todos{?limit,afterPosition}',
    },
  },
  'nb:Note': {
    urn: 'urn:representation:nb.Note:1.0.0',
    version: '1.0.0',
    collection: { href: '/api/notes', template: '/api/notes{?cursor,limit}' },
    resource: { template: '/api/notes/{id}' },
    itemEvents: {
      href: '/api/notes/{id}/events',
      template: '/api/notes/{id}/events{?limit,afterPosition}',
    },
    aggregateEvents: {
      href: '/api/events/notes',
      template: '/api/events/notes{?limit,afterPosition}',
    },
    generatedIdReferences: [
      { kind: 'id', path: '$.notebookId', aggregateUrn: 'urn:aggregate:nb.Notebook' },
    ],
  },
  'nb:Notebook': {
    urn: 'urn:representation:nb.Notebook:1.0.0',
    version: '1.0.0',
    collection: { href: '/api/notebooks', template: '/api/notebooks{?cursor,limit}' },
    resource: { template: '/api/notebooks/{id}' },
    itemEvents: {
      href: '/api/notebooks/{id}/events',
      template: '/api/notebooks/{id}/events{?limit,afterPosition}',
    },
    aggregateEvents: {
      href: '/api/events/notebooks',
      template: '/api/events/notebooks{?limit,afterPosition}',
    },
  },
  'storage:FileObject': {
    urn: 'urn:representation:storage.FileObject:1.0.0',
    version: '1.0.0',
    collection: { href: '/api/file-objects', template: '/api/file-objects{?cursor,limit,noteId}' },
    resource: { template: '/api/file-objects/{id}' },
    itemEvents: {
      href: '/api/file-objects/{id}/events',
      template: '/api/file-objects/{id}/events{?limit,afterPosition}',
    },
    aggregateEvents: {
      href: '/api/events/file-objects',
      template: '/api/events/file-objects{?limit,afterPosition}',
    },
    generatedIdReferences: [
      { kind: 'id', path: '$.noteId', aggregateUrn: 'urn:aggregate:nb.Note' },
      { kind: 'id', path: '$.notebookId', aggregateUrn: 'urn:aggregate:nb.Notebook' },
    ],
  },
}
