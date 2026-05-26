import { ClientAggregate, type EntityId } from '@cqrs-toolkit/client'
import type { ServiceLink } from '@meticoeus/ddd-es'
import { describe, expect, it } from 'vitest'
import { getGeneratedIdReferences } from './get-generated-id-references.js'
import type { RepresentationManifest, RepresentationSurfaces } from './types.js'

const NoteAggregate = new ClientAggregate<ServiceLink>({
  service: 'nb',
  type: 'Note',
  getStreamId: (id: EntityId) => `nb.Note-${String(id)}`,
})
const NotebookAggregate = new ClientAggregate<ServiceLink>({
  service: 'nb',
  type: 'Notebook',
  getStreamId: (id: EntityId) => `nb.Notebook-${String(id)}`,
})

const surfaces = {
  collection: { template: '/api/notes{?cursor,limit}' },
  resource: { template: '/api/notes/{id}' },
  itemEvents: { template: '/api/notes/{id}/events' },
  aggregateEvents: { template: '/api/events/notes' },
}

function manifest(extra: Partial<RepresentationSurfaces> = {}): RepresentationManifest {
  return {
    'demo:Note': {
      urn: 'urn:representation:nb.Note:1.0.0',
      version: '1.0.0',
      ...surfaces,
      ...extra,
    } as RepresentationSurfaces,
  }
}

describe('getGeneratedIdReferences', () => {
  it('resolves id-kind references to runtime IdReference objects', () => {
    const m = manifest({
      generatedIdReferences: [
        { kind: 'id', path: '$.notebookId', aggregateUrn: 'urn:aggregate:nb.Notebook' },
      ],
    })
    const refs = getGeneratedIdReferences('urn:representation:nb.Note:1.0.0', m, {
      'urn:aggregate:nb.Notebook': NotebookAggregate,
    })
    expect(refs).toEqual([{ aggregate: NotebookAggregate, path: '$.notebookId' }])
  })

  it('resolves link-kind references with multiple aggregates', () => {
    const m = manifest({
      generatedIdReferences: [
        {
          kind: 'link',
          path: '$._links.related',
          aggregateUrns: ['urn:aggregate:nb.Note', 'urn:aggregate:nb.Notebook'],
        },
      ],
    })
    const refs = getGeneratedIdReferences('urn:representation:nb.Note:1.0.0', m, {
      'urn:aggregate:nb.Note': NoteAggregate,
      'urn:aggregate:nb.Notebook': NotebookAggregate,
    })
    expect(refs).toEqual([
      {
        aggregates: [NoteAggregate, NotebookAggregate],
        path: '$._links.related',
      },
    ])
  })

  it('returns an empty array when the rep has no generatedIdReferences', () => {
    const m = manifest()
    const refs = getGeneratedIdReferences('urn:representation:nb.Note:1.0.0', m, {})
    expect(refs).toEqual([])
  })

  it('throws on unknown representation URN', () => {
    const m = manifest()
    expect(() => getGeneratedIdReferences('urn:representation:unknown:1.0.0', m, {})).toThrowError(
      /No representation with urn/,
    )
  })

  it('throws on unregistered aggregate URN', () => {
    const m = manifest({
      generatedIdReferences: [
        { kind: 'id', path: '$.notebookId', aggregateUrn: 'urn:aggregate:nb.Notebook' },
      ],
    })
    expect(() => getGeneratedIdReferences('urn:representation:nb.Note:1.0.0', m, {})).toThrowError(
      /aggregate 'urn:aggregate:nb.Notebook' not in registry/,
    )
  })
})
