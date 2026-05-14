import {
  type AggregateConfig,
  type CacheKeyIdentity,
  deriveScopeKey,
  type FetchContext,
} from '@cqrs-toolkit/client'
import type { ServiceLink } from '@meticoeus/ddd-es'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createCollection } from './createCollection.js'
import { expandCollectionTemplate } from './fetchHelpers.js'
import type { RepresentationSurfaces } from './types.js'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NoteAggregate: AggregateConfig<ServiceLink> = {
  service: 'nb',
  type: 'Note',
  getStreamId: (id) => `nb.Note-${String(id)}`,
  getLinkMatcher: () => ({ service: 'nb', type: 'Note' }) as Omit<ServiceLink, 'id'>,
}

const noteRepresentation: RepresentationSurfaces = {
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
}

const scopedNoteRepresentation: RepresentationSurfaces = {
  ...noteRepresentation,
  collection: {
    href: '/api/notebooks/{notebookId}/notes',
    template: '/api/notebooks/{notebookId}/notes{?cursor,limit}',
  },
}

const queryScopedRepresentation: RepresentationSurfaces = {
  ...noteRepresentation,
  collection: {
    href: '/api/pms/milestones',
    template: '/api/pms/milestones{?tenantId,workspaceId,projectId,limit,cursor}',
  },
}

function ctxFor(baseUrl = 'http://localhost:3000'): FetchContext {
  return { baseUrl, headers: {}, signal: new AbortController().signal }
}

function scopeKey(notebookId: string): CacheKeyIdentity<ServiceLink> {
  return deriveScopeKey({ scopeType: 'notebook-notes', scopeParams: { notebookId } })
}

function jsonResponse(body: unknown, init?: { contentType?: string; status?: number }): Response {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { 'content-type': init?.contentType ?? 'application/json' },
  })
}

// ---------------------------------------------------------------------------
// expandCollectionTemplate
// ---------------------------------------------------------------------------

describe('expandCollectionTemplate', () => {
  it('omits the query string when no declared query vars are supplied', () => {
    expect(expandCollectionTemplate('/api/notes{?cursor,limit}', {})).toBe('/api/notes')
  })

  it('expands path variables and percent-encodes values', () => {
    expect(
      expandCollectionTemplate('/api/notebooks/{notebookId}/notes{?cursor,limit}', {
        notebookId: 'nb 1/x',
      }),
    ).toBe('/api/notebooks/nb%201%2Fx/notes')
  })

  it('expands multiple path variables', () => {
    expect(
      expandCollectionTemplate('/api/{tenant}/notebooks/{notebookId}/notes', {
        tenant: 't1',
        notebookId: 'nb-1',
      }),
    ).toBe('/api/t1/notebooks/nb-1/notes')
  })

  it('throws when a declared path variable is not provided', () => {
    expect(() => expandCollectionTemplate('/api/notebooks/{notebookId}/notes', {})).toThrow(
      /notebookId/,
    )
  })

  it('emits form-style query expansion in template declaration order', () => {
    expect(
      expandCollectionTemplate(
        '/api/pms/milestones{?tenantId,workspaceId,projectId,limit,cursor}',
        {
          tenantId: 't1',
          workspaceId: 'w1',
          projectId: 'p1',
          limit: '100',
        },
      ),
    ).toBe('/api/pms/milestones?tenantId=t1&workspaceId=w1&projectId=p1&limit=100')
  })

  it('omits query variables that are missing from the map', () => {
    expect(
      expandCollectionTemplate('/api/pms/milestones{?tenantId,projectId,cursor}', {
        tenantId: 't1',
        projectId: 'p1',
      }),
    ).toBe('/api/pms/milestones?tenantId=t1&projectId=p1')
  })

  it('percent-encodes query values', () => {
    expect(expandCollectionTemplate('/api/items{?name}', { name: 'a&b c?' })).toBe(
      '/api/items?name=a%26b%20c%3F',
    )
  })

  it('mixes path and query expansion', () => {
    expect(
      expandCollectionTemplate(
        '/api/workspaces/{workspaceId}/projects/{projectId}/milestones{?archived,limit}',
        {
          workspaceId: 'w1',
          projectId: 'p1',
          archived: 'false',
          limit: '50',
        },
      ),
    ).toBe('/api/workspaces/w1/projects/p1/milestones?archived=false&limit=50')
  })
})

// ---------------------------------------------------------------------------
// createCollection — wiring
// ---------------------------------------------------------------------------

describe('createCollection', () => {
  it('forwards revisionPath to the returned Collection', () => {
    const collection = createCollection<ServiceLink>({
      name: 'notes',
      aggregate: NoteAggregate,
      revisionPath: '$.latestRevision',
      representation: noteRepresentation,
      cacheKeysFromTopics: () => [],
      matchesStream: (s) => s.startsWith('nb.Note-'),
    })
    expect(collection.revisionPath).toBe('$.latestRevision')
  })

  it('does not wire fetchSeedRecords when fetchTemplateVariables is absent', () => {
    const collection = createCollection<ServiceLink>({
      name: 'notes',
      aggregate: NoteAggregate,
      representation: noteRepresentation,
      cacheKeysFromTopics: () => [],
      matchesStream: (s) => s.startsWith('nb.Note-'),
    })
    expect(collection.fetchSeedRecords).toBeUndefined()
    expect(collection.fetchSeedEvents).toBeDefined()
  })

  it('wires fetchSeedRecords when fetchTemplateVariables is provided', () => {
    const collection = createCollection<ServiceLink>({
      name: 'notes',
      aggregate: NoteAggregate,
      representation: noteRepresentation,
      cacheKeysFromTopics: () => [],
      matchesStream: (s) => s.startsWith('nb.Note-'),
      fetchTemplateVariables: () => ({}),
    })
    expect(collection.fetchSeedRecords).toBeDefined()
    expect(collection.fetchSeedEvents).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// fetchSeedRecords through createCollection
// ---------------------------------------------------------------------------

describe('createCollection.fetchSeedRecords', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    fetchSpy.mockRestore()
  })

  it('expands path-scoped template variables and merges library cursor/limit', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ entities: [], nextCursor: null }))

    const collection = createCollection<ServiceLink>({
      name: 'notes',
      aggregate: NoteAggregate,
      representation: scopedNoteRepresentation,
      cacheKeysFromTopics: () => [],
      matchesStream: (s) => s.startsWith('nb.Note-'),
      fetchTemplateVariables: (cacheKey) => {
        expect(cacheKey.kind).toBe('scope')
        return { notebookId: 'nb-1' }
      },
    })

    await collection.fetchSeedRecords!({
      ctx: ctxFor(),
      cursor: 'CURSOR_X',
      limit: 50,
      cacheKey: scopeKey('nb-1'),
    })

    expect(fetchSpy).toHaveBeenCalledOnce()
    const url = String(fetchSpy.mock.calls[0]![0])
    expect(url).toBe('http://localhost:3000/api/notebooks/nb-1/notes?cursor=CURSOR_X&limit=50')
  })

  it('emits consumer-supplied query-scoped variables when the template declares no path placeholders', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ entities: [], nextCursor: null }))

    const collection = createCollection<ServiceLink>({
      name: 'milestones',
      aggregate: NoteAggregate,
      representation: queryScopedRepresentation,
      cacheKeysFromTopics: () => [],
      matchesStream: () => false,
      fetchTemplateVariables: () => ({
        tenantId: 't1',
        workspaceId: 'w1',
        projectId: 'p1',
      }),
    })

    await collection.fetchSeedRecords!({
      ctx: ctxFor(),
      cursor: null,
      limit: 100,
      cacheKey: scopeKey('p1'),
    })

    const url = String(fetchSpy.mock.calls[0]![0])
    expect(url).toBe(
      'http://localhost:3000/api/pms/milestones?tenantId=t1&workspaceId=w1&projectId=p1&limit=100',
    )
  })

  it('sends Accept: application/hal+json with JSON fallback and merges fetchHeaders', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ entities: [], nextCursor: null }))

    const collection = createCollection<ServiceLink>({
      name: 'notes',
      aggregate: NoteAggregate,
      representation: noteRepresentation,
      cacheKeysFromTopics: () => [],
      matchesStream: (s) => s.startsWith('nb.Note-'),
      fetchTemplateVariables: () => ({}),
      fetchHeaders: () => ({ 'x-tenant-id': 't1' }),
    })

    await collection.fetchSeedRecords!({
      ctx: ctxFor(),
      cursor: null,
      limit: 100,
      cacheKey: scopeKey('any'),
    })

    const init = fetchSpy.mock.calls[0]![1] as RequestInit
    const headers = init.headers as Record<string, string>
    expect(headers['Accept']).toBe('application/hal+json, application/json;q=0.9')
    expect(headers['x-tenant-id']).toBe('t1')
  })

  it('parses plain JSON envelope responses', async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({
        entities: [
          { id: 'note-1', title: 'Hello', latestRevision: '7' },
          { id: 'note-2', title: 'World', latestRevision: '12' },
        ],
        nextCursor: 'NEXT',
      }),
    )

    const collection = createCollection<ServiceLink>({
      name: 'notes',
      aggregate: NoteAggregate,
      revisionPath: '$.latestRevision',
      representation: noteRepresentation,
      cacheKeysFromTopics: () => [],
      matchesStream: (s) => s.startsWith('nb.Note-'),
      fetchTemplateVariables: () => ({}),
    })

    const page = await collection.fetchSeedRecords!({
      ctx: ctxFor(),
      cursor: null,
      limit: 100,
      cacheKey: scopeKey('any'),
    })

    expect(page.records).toHaveLength(2)
    expect(page.records[0]).toEqual({
      id: 'note-1',
      data: { id: 'note-1', title: 'Hello', latestRevision: '7' },
      revision: '7',
    })
    expect(page.records[1]!.revision).toBe('12')
    expect(page.nextCursor).toBe('NEXT')
  })

  it('parses HAL envelope responses, strips _links, and extracts nextCursor from _links.next.href', async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse(
        {
          _links: {
            self: { href: '/api/notes' },
            next: { href: '/api/notes?cursor=NEXT_CURSOR&limit=100' },
          },
          _embedded: {
            item: [
              {
                _links: { self: { href: '/api/notes/note-1' } },
                id: 'note-1',
                title: 'Hello',
                latestRevision: '7',
              },
              {
                _links: { self: { href: '/api/notes/note-2' } },
                id: 'note-2',
                title: 'World',
                latestRevision: '12',
              },
            ],
          },
        },
        { contentType: 'application/hal+json' },
      ),
    )

    const collection = createCollection<ServiceLink>({
      name: 'notes',
      aggregate: NoteAggregate,
      revisionPath: '$.latestRevision',
      representation: noteRepresentation,
      cacheKeysFromTopics: () => [],
      matchesStream: (s) => s.startsWith('nb.Note-'),
      fetchTemplateVariables: () => ({}),
    })

    const page = await collection.fetchSeedRecords!({
      ctx: ctxFor(),
      cursor: null,
      limit: 100,
      cacheKey: scopeKey('any'),
    })

    expect(page.records).toHaveLength(2)
    expect(page.records[0]).toEqual({
      id: 'note-1',
      data: { id: 'note-1', title: 'Hello', latestRevision: '7' },
      revision: '7',
    })
    expect(page.records[1]!.revision).toBe('12')
    expect(page.nextCursor).toBe('NEXT_CURSOR')
  })

  it('preserves nested _embedded on HAL members with recursive _links stripping', async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse(
        {
          _links: { self: { href: '/api/notes' } },
          _embedded: {
            item: [
              {
                _links: { self: { href: '/api/notes/note-1' } },
                id: 'note-1',
                title: 'Hello',
                metadata: { tags: ['a', 'b'], extra: { ref: 'opaque' } },
                _embedded: {
                  author: {
                    _links: { self: { href: '/api/users/u-1' } },
                    id: 'u-1',
                    name: 'Alice',
                    _embedded: {
                      team: {
                        _links: { self: { href: '/api/teams/t-1' } },
                        id: 't-1',
                        name: 'Engineering',
                      },
                    },
                  },
                  tags: [
                    { _links: { self: { href: '/api/tags/tg-1' } }, id: 'tg-1', label: 'urgent' },
                    { _links: { self: { href: '/api/tags/tg-2' } }, id: 'tg-2', label: 'review' },
                  ],
                },
              },
            ],
          },
        },
        { contentType: 'application/hal+json' },
      ),
    )

    const collection = createCollection<ServiceLink>({
      name: 'notes',
      aggregate: NoteAggregate,
      representation: noteRepresentation,
      cacheKeysFromTopics: () => [],
      matchesStream: (s) => s.startsWith('nb.Note-'),
      fetchTemplateVariables: () => ({}),
    })

    const page = await collection.fetchSeedRecords!({
      ctx: ctxFor(),
      cursor: null,
      limit: 100,
      cacheKey: scopeKey('any'),
    })

    expect(page.records[0]!.data).toEqual({
      id: 'note-1',
      title: 'Hello',
      // Domain property — opaque, no recursive strip even if it happened to contain "ref"
      metadata: { tags: ['a', 'b'], extra: { ref: 'opaque' } },
      _embedded: {
        author: {
          // _links stripped recursively
          id: 'u-1',
          name: 'Alice',
          _embedded: {
            team: {
              id: 't-1',
              name: 'Engineering',
            },
          },
        },
        tags: [
          { id: 'tg-1', label: 'urgent' },
          { id: 'tg-2', label: 'review' },
        ],
      },
    })
  })

  it('leaves SeedRecord.revision undefined when revisionPath is absent', async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({
        entities: [{ id: 'note-1', title: 'Hello', latestRevision: '7' }],
        nextCursor: null,
      }),
    )

    const collection = createCollection<ServiceLink>({
      name: 'notes',
      aggregate: NoteAggregate,
      representation: noteRepresentation,
      cacheKeysFromTopics: () => [],
      matchesStream: (s) => s.startsWith('nb.Note-'),
      fetchTemplateVariables: () => ({}),
    })

    const page = await collection.fetchSeedRecords!({
      ctx: ctxFor(),
      cursor: null,
      limit: 100,
      cacheKey: scopeKey('any'),
    })

    expect(page.records[0]!.revision).toBeUndefined()
  })

  it('throws when a declared template variable is not provided by fetchTemplateVariables', async () => {
    const collection = createCollection<ServiceLink>({
      name: 'notes',
      aggregate: NoteAggregate,
      representation: scopedNoteRepresentation,
      cacheKeysFromTopics: () => [],
      matchesStream: (s) => s.startsWith('nb.Note-'),
      fetchTemplateVariables: () => ({}),
    })

    await expect(
      collection.fetchSeedRecords!({
        ctx: ctxFor(),
        cursor: null,
        limit: 100,
        cacheKey: scopeKey('any'),
      }),
    ).rejects.toThrow(/notebookId/)
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
