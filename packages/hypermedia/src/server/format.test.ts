import { describe, expect, it } from 'vitest'
import { HAL } from '../hal.js'
import type { CursorPagination, EventCursorPagination } from '../shared-types.js'
import type { HypermediaTypes } from '../types.js'
import { Hypermedia } from './format.js'

const ITEM_CLASS = 'test:Item'

describe('Hypermedia.buildCollectionDescriptor', () => {
  it('builds descriptor with members mapped via buildMember', () => {
    const conn = connection([{ id: '1' }, { id: '2' }])
    const desc = Hypermedia.buildCollectionDescriptor({
      connection: conn,
      page: { self: '/api/items', first: '/api/items' },
      buildMember: (data) => ({ class: ITEM_CLASS, properties: data }),
    })
    expect(desc.members).toHaveLength(2)
    expect((desc.members[0] as HypermediaTypes.ResourceDescriptor).properties).toEqual({ id: '1' })
  })

  it('includes totalItems from connection.total', () => {
    const conn = connection([], { total: 10 })
    const desc = Hypermedia.buildCollectionDescriptor({
      connection: conn,
      page: { self: '/api/items' },
      buildMember: (data) => ({ class: ITEM_CLASS, properties: data }),
    })
    expect(desc.totalItems).toBe(10)
  })

  it('omits totalItems when connection.total is undefined', () => {
    const conn = connection([])
    const desc = Hypermedia.buildCollectionDescriptor({
      connection: conn,
      page: { self: '/api/items' },
      buildMember: (data) => ({ class: ITEM_CLASS, properties: data }),
    })
    expect(desc.totalItems).toBeUndefined()
  })

  it('includes counts from connection.counts', () => {
    const conn = connection([], { counts: { active: 5 } })
    const desc = Hypermedia.buildCollectionDescriptor({
      connection: conn,
      page: { self: '/api/items' },
      buildMember: (data) => ({ class: ITEM_CLASS, properties: data }),
    })
    expect(desc.counts).toEqual({ active: 5 })
  })

  it('passes context through to descriptor', () => {
    const conn = connection([])
    const desc = Hypermedia.buildCollectionDescriptor({
      connection: conn,
      page: { self: '/api/items' },
      buildMember: (data) => ({ class: ITEM_CLASS, properties: data }),
      context: { roomId: 'r1' },
    })
    expect(desc.context).toEqual({ roomId: 'r1' })
  })
})

describe('Hypermedia.pageViewFromCursor', () => {
  it('builds self from path and query', () => {
    const conn = connection([], { nextCursor: null })
    const pv = Hypermedia.pageViewFromCursor(conn, {
      path: '/api/items',
      query: { q: 'test', cursor: 'abc' },
    })
    expect(pv.self).toBe('/api/items?q=test&cursor=abc')
  })

  it('builds first by removing cursor from query', () => {
    const conn = connection([])
    const pv = Hypermedia.pageViewFromCursor(conn, {
      path: '/api/items',
      query: { q: 'test', cursor: 'abc' },
    })
    expect(pv.first).toBe('/api/items?q=test')
  })

  it('builds next when nextCursor is present', () => {
    const conn = connection([], { nextCursor: 'xyz' })
    const pv = Hypermedia.pageViewFromCursor(conn, {
      path: '/api/items',
      query: { q: 'test' },
    })
    expect(pv.next).toBe('/api/items?q=test&cursor=xyz')
  })

  it('omits next when nextCursor is null', () => {
    const conn = connection([], { nextCursor: null })
    const pv = Hypermedia.pageViewFromCursor(conn, {
      path: '/api/items',
      query: { q: 'test' },
    })
    expect(pv.next).toBeUndefined()
  })

  it('builds prev when prevCursor is present', () => {
    const conn = connection([], { prevCursor: 'prev1' })
    const pv = Hypermedia.pageViewFromCursor(conn, {
      path: '/api/items',
      query: { q: 'test' },
    })
    expect(pv.prev).toBe('/api/items?q=test&cursor=prev1')
  })

  it('omits prev when prevCursor is absent', () => {
    const conn = connection([])
    const pv = Hypermedia.pageViewFromCursor(conn, {
      path: '/api/items',
      query: { q: 'test' },
    })
    expect(pv.prev).toBeUndefined()
  })

  it('returns path only when query is empty', () => {
    const conn = connection([])
    const pv = Hypermedia.pageViewFromCursor(conn, {
      path: '/api/items',
      query: undefined,
    })
    expect(pv.self).toBe('/api/items')
  })

  it('handles array query parameters', () => {
    const conn = connection([])
    const pv = Hypermedia.pageViewFromCursor(conn, {
      path: '/api/items',
      query: { include: ['total', 'counts'] },
    })
    expect(pv.self).toContain('include=total')
    expect(pv.self).toContain('include=counts')
  })
})

describe('Hypermedia.eventPageViewFromCursor', () => {
  it('uses afterRevision key when revision option is true', () => {
    const conn: EventCursorPagination.Connection<object> = {
      entities: [],
      nextCursor: '42',
    }
    const pv = Hypermedia.eventPageViewFromCursor(conn, {
      path: '/api/events',
      query: undefined,
      revision: true,
    })
    expect(pv.next).toBe('/api/events?afterRevision=42')
  })

  it('uses afterPosition key when revision option is false', () => {
    const conn: EventCursorPagination.Connection<object> = {
      entities: [],
      nextCursor: '42',
    }
    const pv = Hypermedia.eventPageViewFromCursor(conn, {
      path: '/api/events',
      query: undefined,
      revision: false,
    })
    expect(pv.next).toBe('/api/events?afterPosition=42')
  })

  it('strips all paging params for first link', () => {
    const conn: EventCursorPagination.Connection<object> = {
      entities: [],
      nextCursor: null,
    }
    const pv = Hypermedia.eventPageViewFromCursor(conn, {
      path: '/api/events',
      query: { afterRevision: '10', afterPosition: '5', cursor: 'abc', limit: '20' },
    })
    expect(pv.first).toBe('/api/events?limit=20')
  })

  it('omits next when nextCursor is null', () => {
    const conn: EventCursorPagination.Connection<object> = {
      entities: [],
      nextCursor: null,
    }
    const pv = Hypermedia.eventPageViewFromCursor(conn, {
      path: '/api/events',
      query: undefined,
    })
    expect(pv.next).toBeUndefined()
  })
})

describe('Hypermedia.formatResource', () => {
  it('returns HAL when Accept is application/hal+json', () => {
    const result = Hypermedia.formatResource(halRequest('application/hal+json'), itemDesc(), {
      halDefs: [itemDef()],
    })
    expect(result.contentType).toBe('application/hal+json')
    expect(result.body._links).toBeDefined()
  })

  it('returns HAL when Accept is */*', () => {
    const result = Hypermedia.formatResource(halRequest('*/*'), itemDesc(), {
      halDefs: [itemDef()],
    })
    expect(result.contentType).toBe('application/hal+json')
  })

  it('returns HAL when Accept is absent', () => {
    const result = Hypermedia.formatResource({ headers: {} }, itemDesc(), { halDefs: [itemDef()] })
    expect(result.contentType).toBe('application/hal+json')
  })

  it('returns JSON when Accept is application/json', () => {
    const result = Hypermedia.formatResource(halRequest('application/json'), itemDesc(), {
      halDefs: [itemDef()],
    })
    expect(result.contentType).toBe('application/json')
    expect(result.body).toEqual({ id: 'item-1', name: 'Test' })
  })
})

describe('Hypermedia.formatCollection', () => {
  it('returns HAL when Accept is application/hal+json', () => {
    const desc: HypermediaTypes.CollectionDescriptor = {
      members: [itemDesc()],
      page: { self: '/api/items' },
    }
    const result = Hypermedia.formatCollection(halRequest('application/hal+json'), desc, {
      halDefs: [itemDef()],
      collectionDef: collectionDef(),
    })
    expect(result.contentType).toBe('application/hal+json')
    expect(result.body._embedded).toBeDefined()
  })

  it('returns JSON fallback with entities/nextCursor/totalItems shape', () => {
    const desc: HypermediaTypes.CollectionDescriptor = {
      members: [itemDesc()],
      page: { self: '/api/items' },
      totalItems: 1,
    }
    const result = Hypermedia.formatCollection(halRequest('application/json'), desc, {
      halDefs: [itemDef()],
      collectionDef: collectionDef(),
    })
    expect(result.contentType).toBe('application/json')
    expect(result.body.entities).toHaveLength(1)
    expect(result.body.totalItems).toBe(1)
  })

  it('extracts cursor from next link URL for JSON fallback', () => {
    const desc: HypermediaTypes.CollectionDescriptor = {
      members: [],
      page: { self: '/api/items', next: '/api/items?cursor=abc' },
    }
    const result = Hypermedia.formatCollection(halRequest('application/json'), desc, {
      halDefs: [itemDef()],
      collectionDef: collectionDef(),
    })
    expect(result.body.nextCursor).toBe('abc')
  })

  it('returns null nextCursor when no next page', () => {
    const desc: HypermediaTypes.CollectionDescriptor = {
      members: [],
      page: { self: '/api/items' },
    }
    const result = Hypermedia.formatCollection(halRequest('application/json'), desc, {
      halDefs: [itemDef()],
      collectionDef: collectionDef(),
    })
    expect(result.body.nextCursor).toBeNull()
  })

  it('includes _counts in JSON fallback', () => {
    const desc: HypermediaTypes.CollectionDescriptor = {
      members: [],
      page: { self: '/api/items' },
      counts: { active: 3 },
    }
    const result = Hypermedia.formatCollection(halRequest('application/json'), desc, {
      halDefs: [itemDef()],
      collectionDef: collectionDef(),
    })
    expect(result.body._counts).toEqual({ active: 3 })
  })
})

function itemDef(): HAL.ResourceDefinition {
  return {
    class: ITEM_CLASS,
    idTemplate: '/api/items/{id}',
    collectionLink: { href: '/api/items' },
  }
}

function itemDesc(id = 'item-1'): HypermediaTypes.ResourceDescriptor {
  return { class: ITEM_CLASS, properties: { id, name: 'Test' } }
}

function connection<T extends object>(
  entities: T[],
  overrides: Partial<CursorPagination.Connection<T>> = {},
): CursorPagination.Connection<T> {
  return {
    entities,
    nextCursor: null,
    ...overrides,
  }
}

function halRequest(accept = 'application/hal+json'): Hypermedia.Request {
  return { headers: { accept } }
}

function collectionDef(): HAL.CollectionDefinitionRep {
  return new HAL.CollectionDefinitionRep({
    itemClass: ITEM_CLASS,
    searchTemplate: { template: '/api/items{?q,cursor,limit}' },
  } as any)
}
