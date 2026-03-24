/**
 * Generated representation surfaces — do not edit.
 * Regenerate with: cqrs-pull generate
 */

import type { RepresentationSurfaces } from '@cqrs-toolkit/hypermedia-client'

interface Representations {
  'demo:Todo': RepresentationSurfaces
  'demo:Note': RepresentationSurfaces
  'demo:Notebook': RepresentationSurfaces
}

export const representations: Representations = {
  'demo:Todo': {
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
  'demo:Note': {
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
  },
  'demo:Notebook': {
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
}
