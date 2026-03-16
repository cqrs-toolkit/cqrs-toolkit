import { describe, expect, it } from 'vitest'
import { HAL } from './hal.js'
import type { HypermediaTypes } from './types.js'

const ITEM_CLASS = 'test:Item'
const CHILD_CLASS = 'test:Child'
const CATEGORY_CLASS = 'test:Category'

describe('HAL', () => {
  describe('CollectionDefinitionRep', () => {
    it('derives href by stripping query expansion from searchTemplate', () => {
      const cdef = collectionDef()
      expect(cdef.href).toBe('/api/items')
    })

    it('uses explicit href when provided', () => {
      const cdef = collectionDef({ href: '/api/custom-items' })
      expect(cdef.href).toBe('/api/custom-items')
    })

    it('asserts when href contains query expansion', () => {
      expect(
        () =>
          new HAL.CollectionDefinitionRep({
            itemClass: ITEM_CLASS,
            searchTemplate: { template: '/api/items{?q}' },
            href: '/api/items{?q}',
          } as any),
      ).toThrow(/base href/)
    })

    it('asserts when href contains question mark', () => {
      expect(
        () =>
          new HAL.CollectionDefinitionRep({
            itemClass: ITEM_CLASS,
            searchTemplate: { template: '/api/items{?q}' },
            href: '/api/items?foo=1',
          } as any),
      ).toThrow(/base href/)
    })

    it('from returns existing instance unchanged', () => {
      const cdef = collectionDef()
      expect(HAL.CollectionDefinitionRep.from(cdef)).toBe(cdef)
    })

    it('from wraps a plain object', () => {
      const plain = {
        itemClass: ITEM_CLASS,
        searchTemplate: { template: '/api/items{?q}' },
      }
      const result = HAL.CollectionDefinitionRep.from(plain as any)
      expect(result).toBeInstanceOf(HAL.CollectionDefinitionRep)
      expect(result.href).toBe('/api/items')
    })

    it('expandHrefBase resolves path tokens from context', () => {
      const cdef = new HAL.CollectionDefinitionRep({
        itemClass: ITEM_CLASS,
        searchTemplate: { template: '/api/rooms/{roomId}/items{?q}' },
        href: '/api/rooms/{roomId}/items',
      } as any)
      expect(cdef.expandHrefBase({ roomId: 'r-42' })).toBe('/api/rooms/r-42/items')
    })

    it('expandHrefBase asserts on unresolved tokens', () => {
      const cdef = new HAL.CollectionDefinitionRep({
        itemClass: ITEM_CLASS,
        searchTemplate: { template: '/api/rooms/{roomId}/items{?q}' },
        href: '/api/rooms/{roomId}/items',
      } as any)
      expect(() => cdef.expandHrefBase({})).toThrow(/unable to fully resolve/)
    })

    it('defaults kind to canonical', () => {
      expect(collectionDef().kind).toBe('canonical')
    })

    it('respects explicit kind: view', () => {
      expect(collectionDef({ kind: 'view' }).kind).toBe('view')
    })
  })

  describe('fromResource', () => {
    it('copies properties to body', () => {
      const body = HAL.fromResource(itemDesc(), [itemDef()])
      expect(body.id).toBe('item-1')
      expect(body.name).toBe('Test Item')
    })

    it('builds self link from idTemplate', () => {
      const body = HAL.fromResource(itemDesc(), [itemDef()])
      expect(body._links.self.href).toBe('/api/items/item-1')
    })

    it('builds collection link from collectionLink', () => {
      const body = HAL.fromResource(itemDesc(), [itemDef()])
      expect(body._links.collection.href).toBe('/api/items')
    })

    it('builds collection link with custom rel', () => {
      const def = itemDef({ collectionLink: { href: '/api/items', rel: 'test:items' } })
      const body = HAL.fromResource(itemDesc(), [def])
      expect(body._links['test:items']).toBeDefined()
      expect(body._links['test:items'].href).toBe('/api/items')
      expect(body._links.collection).toBeUndefined()
    })

    it('omits all links when linkDensity is omit', () => {
      const body = HAL.fromResource(itemDesc(), [itemDef()], { linkDensity: 'omit' })
      expect(body._links).toBeUndefined()
    })

    it('emits only self/collection/curies when linkDensity is lean', () => {
      const def = itemDef({
        extraLinks: [{ rel: 'test:related', href: '/api/related/{id}' }],
      })
      const body = HAL.fromResource(itemDesc(), [def], { linkDensity: 'lean' })
      expect(body._links.self).toBeDefined()
      expect(body._links.collection).toBeDefined()
      expect(body._links['test:related']).toBeUndefined()
    })

    it('uses linkDensity from ResourceDefinition over RendererOptions', () => {
      const def = itemDef({ linkDensity: 'omit' })
      const body = HAL.fromResource(itemDesc(), [def], { linkDensity: 'full' })
      expect(body._links).toBeUndefined()
    })

    it('expands selfTypeTemplate into self link type', () => {
      const desc = itemDesc({ properties: { id: 'item-1', contentType: 'image/png' } })
      const def = itemDef({ selfTypeTemplate: '{contentType}' })
      const body = HAL.fromResource(desc, [def])
      expect(body._links.self.type).toBe('image/png')
    })

    it('omits self link type when selfTypeTemplate cannot resolve', () => {
      const def = itemDef({ selfTypeTemplate: '{unknownField}' })
      const body = HAL.fromResource(itemDesc(), [def])
      expect(body._links.self.type).toBeUndefined()
    })

    it('embeds to-many children as arrays', () => {
      const desc = itemDesc({
        embedded: {
          [CHILD_CLASS]: [childDesc(), childDesc({ properties: { id: 'child-2', label: 'Two' } })],
        },
      })
      const body = HAL.fromResource(desc, [itemDef(), childDef()])
      expect(body._embedded['test:child']).toHaveLength(2)
    })

    it('forces array for single child when collection flag is set', () => {
      const def = itemDef({
        children: [{ class: CHILD_CLASS, embed: { collection: true } }],
      })
      const desc = itemDesc({ embedded: { [CHILD_CLASS]: childDesc() } })
      const body = HAL.fromResource(desc, [def, childDef()])
      expect(Array.isArray(body._embedded['test:child'])).toBe(true)
      expect(body._embedded['test:child']).toHaveLength(1)
    })

    it('does not force array for single child without collection flag', () => {
      const desc = itemDesc({ embedded: { [CHILD_CLASS]: childDesc() } })
      const body = HAL.fromResource(desc, [itemDef(), childDef()])
      expect(Array.isArray(body._embedded['test:child'])).toBe(false)
    })

    it('embeds one-to-one resource as object', () => {
      const def = itemDef({
        embeddedResources: [{ class: CATEGORY_CLASS }],
      })
      const catDesc: HypermediaTypes.ResourceDescriptor = {
        class: CATEGORY_CLASS,
        properties: { id: 'cat-1', name: 'Category' },
      }
      const desc = itemDesc({ embedded: { [CATEGORY_CLASS]: catDesc } })
      const body = HAL.fromResource(desc, [def])
      expect(body._embedded['test:category']).toEqual({ id: 'cat-1', name: 'Category' })
    })

    it('uses first element when one-to-one receives array', () => {
      const def = itemDef({ embeddedResources: [{ class: CATEGORY_CLASS }] })
      const catDesc: HypermediaTypes.ResourceDescriptor = {
        class: CATEGORY_CLASS,
        properties: { id: 'cat-1', name: 'First' },
      }
      const catDesc2: HypermediaTypes.ResourceDescriptor = {
        class: CATEGORY_CLASS,
        properties: { id: 'cat-2', name: 'Second' },
      }
      const desc = itemDesc({ embedded: { [CATEGORY_CLASS]: [catDesc, catDesc2] } })
      const body = HAL.fromResource(desc, [def])
      expect(body._embedded['test:category']).toEqual({ id: 'cat-1', name: 'First' })
    })

    it('omits one-to-one embed when value is null', () => {
      const def = itemDef({ embeddedResources: [{ class: CATEGORY_CLASS }] })
      const desc = itemDesc({ embedded: { [CATEGORY_CLASS]: [] as any } })
      const body = HAL.fromResource(desc, [def])
      expect(body._embedded).toBeUndefined()
    })

    it('derives child rel from class via kebabCase', () => {
      const desc = itemDesc({
        embedded: { 'test:DataTag': [{ class: 'test:DataTag', properties: { id: 't-1' } }] },
      })
      const body = HAL.fromResource(desc, [itemDef()])
      expect(body._embedded['test:data-tag']).toBeDefined()
    })

    it('uses explicit child rel from children config', () => {
      const def = itemDef({
        children: [{ class: CHILD_CLASS, rel: 'test:my-children' }],
      })
      const desc = itemDesc({ embedded: { [CHILD_CLASS]: [childDesc()] } })
      const body = HAL.fromResource(desc, [def, childDef()])
      expect(body._embedded['test:my-children']).toBeDefined()
    })

    it('uses embedRel from embeddedResources config', () => {
      const def = itemDef({
        embeddedResources: [{ class: CATEGORY_CLASS, embedRel: 'test:cat' }],
      })
      const catDesc: HypermediaTypes.ResourceDescriptor = {
        class: CATEGORY_CLASS,
        properties: { id: 'cat-1' },
      }
      const desc = itemDesc({ embedded: { [CATEGORY_CLASS]: catDesc } })
      const body = HAL.fromResource(desc, [def])
      expect(body._embedded['test:cat']).toBeDefined()
    })

    it('recursively renders embedded ResourceDescriptors', () => {
      const desc = itemDesc({
        embedded: { [CHILD_CLASS]: [childDesc()] },
      })
      const body = HAL.fromResource(desc, [itemDef(), childDef()])
      const embedded = body._embedded['test:child'][0]
      expect(embedded._links).toBeDefined()
      expect(embedded._links.self.href).toBe('/api/children/child-1')
    })

    it('passes through embedded non-descriptor objects as-is', () => {
      const plainObj = { foo: 'bar' }
      const desc = itemDesc({
        embedded: { [CHILD_CLASS]: [plainObj as any] },
      })
      const body = HAL.fromResource(desc, [itemDef()])
      expect(body._embedded['test:child'][0]).toEqual({ foo: 'bar' })
    })

    it('builds CURIE links from embedded prefixes', () => {
      const desc = itemDesc({
        embedded: { [CHILD_CLASS]: [childDesc()] },
      })
      const body = HAL.fromResource(desc, [itemDef(), childDef()])
      const curies = body._links.curies
      expect(curies).toBeDefined()
      expect(curies.some((c: any) => c.name === 'test')).toBe(true)
    })

    it('uses custom curiesBaseHref', () => {
      const def = itemDef({
        curiesBaseHref: '/docs/{prefix}/{rel}',
        extraLinks: [{ rel: 'test:related', href: '/api/related' }],
      })
      const body = HAL.fromResource(itemDesc(), [def])
      const curies = body._links.curies
      expect(curies[0].href).toBe('/docs/test/{rel}')
    })

    it('renders extra links on resource', () => {
      const def = itemDef({
        extraLinks: [{ rel: 'test:related', href: '/api/related/{id}' }],
      })
      const body = HAL.fromResource(itemDesc(), [def])
      expect(body._links['test:related'].href).toBe('/api/related/item-1')
    })

    it('renders child collection links with resolveTokens whitelisting', () => {
      const def = itemDef({
        children: [
          {
            class: CHILD_CLASS,
            collectionLink: {
              href: '/api/items/{id}/children/{childType}',
              templated: true,
              resolveTokens: ['id'],
            },
          },
        ],
      })
      const body = HAL.fromResource(itemDesc(), [def, childDef()])
      const link = body._links['test:child']
      expect(link.href).toBe('/api/items/item-1/children/{childType}')
      expect(link.templated).toBe(true)
    })

    it('strips __collectionContext for nested embedded resources', () => {
      const desc = itemDesc({
        embedded: { [CHILD_CLASS]: [childDesc()] },
      })
      const body = HAL.fromResource(desc, [itemDef(), childDef()], {
        __collectionContext: { memberCollectionHref: '/api/custom-collection' },
      })
      // Direct resource gets the override
      expect(body._links.collection.href).toBe('/api/custom-collection')
      // Embedded child should NOT inherit the override — uses its own collectionLink
      const child = body._embedded['test:child'][0]
      expect(child._links.collection.href).toBe('/api/children')
    })

    it('uses __collectionContext.memberCollectionHref as collection link for direct members', () => {
      const body = HAL.fromResource(itemDesc(), [itemDef()], {
        __collectionContext: { memberCollectionHref: '/api/custom-collection' },
      })
      expect(body._links.collection.href).toBe('/api/custom-collection')
    })

    it('produces no _embedded when embedded map is empty', () => {
      const desc = itemDesc({ embedded: {} })
      const body = HAL.fromResource(desc, [itemDef()])
      expect(body._embedded).toBeUndefined()
    })
  })

  describe('fromCollection', () => {
    it('renders pagination links', () => {
      const desc: HypermediaTypes.CollectionDescriptor = {
        members: [],
        page: pageView({
          self: '/api/items?cursor=abc',
          first: '/api/items',
          prev: '/api/items?cursor=prev',
          next: '/api/items?cursor=next',
        }),
      }
      const body = HAL.fromCollection(desc, [itemDef()], collectionDef())
      expect(body._links.self.href).toBe('/api/items?cursor=abc')
      expect(body._links.first.href).toBe('/api/items')
      expect(body._links.prev.href).toBe('/api/items?cursor=prev')
      expect(body._links.next.href).toBe('/api/items?cursor=next')
    })

    it('renders search link as templated', () => {
      const desc: HypermediaTypes.CollectionDescriptor = { members: [], page: pageView() }
      const body = HAL.fromCollection(desc, [itemDef()], collectionDef())
      expect(body._links.search.templated).toBe(true)
      expect(body._links.search.href).toBe('/api/items{?q,cursor,limit}')
    })

    it('renders members as _embedded.item array', () => {
      const desc: HypermediaTypes.CollectionDescriptor = {
        members: [itemDesc(), itemDesc({ properties: { id: 'item-2', name: 'Two' } })],
        page: pageView(),
      }
      const body = HAL.fromCollection(desc, [itemDef()], collectionDef())
      expect(body._embedded.item).toHaveLength(2)
      expect(body._embedded.item[0]._links.self.href).toBe('/api/items/item-1')
    })

    it('includes totalItems when present', () => {
      const desc: HypermediaTypes.CollectionDescriptor = {
        members: [],
        page: pageView(),
        totalItems: 42,
      }
      const body = HAL.fromCollection(desc, [itemDef()], collectionDef())
      expect(body.totalItems).toBe(42)
    })

    it('includes _counts when present', () => {
      const desc: HypermediaTypes.CollectionDescriptor = {
        members: [],
        page: pageView(),
        counts: { active: 10 },
      }
      const body = HAL.fromCollection(desc, [itemDef()], collectionDef())
      expect(body._counts).toEqual({ active: 10 })
    })

    it('renders collection-level CURIE from itemClass prefix', () => {
      const desc: HypermediaTypes.CollectionDescriptor = { members: [], page: pageView() }
      const body = HAL.fromCollection(desc, [itemDef()], collectionDef())
      const curies = body._links.curies
      expect(curies).toBeDefined()
      expect(curies.some((c: any) => c.name === 'test')).toBe(true)
    })

    it('renders extra links on collection', () => {
      const cdef = collectionDef({
        extraLinks: [{ rel: 'test:create', href: '/api/items', title: 'Create' }],
      })
      const desc: HypermediaTypes.CollectionDescriptor = { members: [], page: pageView() }
      const body = HAL.fromCollection(desc, [itemDef()], cdef)
      expect(body._links['test:create'].href).toBe('/api/items')
      expect(body._links['test:create'].title).toBe('Create')
    })

    it('renders extra link with force-array collection flag', () => {
      const cdef = collectionDef({
        extraLinks: [{ rel: 'test:create', href: '/api/items', collection: true }],
      })
      const desc: HypermediaTypes.CollectionDescriptor = { members: [], page: pageView() }
      const body = HAL.fromCollection(desc, [itemDef()], cdef)
      expect(Array.isArray(body._links['test:create'])).toBe(true)
    })

    it('passes useSurfaceAsMemberCollection context to member rendering', () => {
      const cdef = collectionDef({ useSurfaceAsMemberCollection: true })
      const desc: HypermediaTypes.CollectionDescriptor = {
        members: [itemDesc()],
        page: pageView(),
      }
      const body = HAL.fromCollection(desc, [itemDef()], cdef)
      expect(body._embedded.item[0]._links.collection.href).toBe('/api/items')
    })
  })

  describe('formsFromActions', () => {
    it('renders action with default contentType', () => {
      const forms = HAL.formsFromActions([{ name: 'Create', method: 'POST', target: '/api/items' }])
      expect(forms.Create.contentType).toBe('application/json')
    })

    it('renders action with custom contentType', () => {
      const forms = HAL.formsFromActions([
        {
          name: 'Upload',
          method: 'POST',
          target: '/api/upload',
          contentType: 'multipart/form-data',
        },
      ])
      expect(forms.Upload.contentType).toBe('multipart/form-data')
    })

    it('renders action with schemaRef', () => {
      const forms = HAL.formsFromActions([
        { name: 'Create', method: 'POST', target: '/api/items', schemaRef: '/schemas/create.json' },
      ])
      expect(forms.Create.schema).toEqual({ $ref: '/schemas/create.json' })
    })

    it('renders action without schemaRef', () => {
      const forms = HAL.formsFromActions([{ name: 'Create', method: 'POST', target: '/api/items' }])
      expect(forms.Create.schema).toBeUndefined()
    })

    it('renders action with properties', () => {
      const props = [{ name: 'title', required: true }]
      const forms = HAL.formsFromActions([
        { name: 'Create', method: 'POST', target: '/api/items', properties: props },
      ])
      expect(forms.Create.properties).toEqual(props)
    })
  })
})

function itemDef(overrides: Partial<HAL.ResourceDefinition> = {}): HAL.ResourceDefinition {
  return {
    class: ITEM_CLASS,
    idTemplate: '/api/items/{id}',
    collectionLink: { href: '/api/items' },
    ...overrides,
  }
}

function itemDesc(
  overrides: Partial<HypermediaTypes.ResourceDescriptor> = {},
): HypermediaTypes.ResourceDescriptor {
  return {
    class: ITEM_CLASS,
    properties: { id: 'item-1', name: 'Test Item' },
    ...overrides,
  }
}

function childDef(overrides: Partial<HAL.ResourceDefinition> = {}): HAL.ResourceDefinition {
  return {
    class: CHILD_CLASS,
    idTemplate: '/api/children/{id}',
    collectionLink: { href: '/api/children' },
    ...overrides,
  }
}

function childDesc(
  overrides: Partial<HypermediaTypes.ResourceDescriptor> = {},
): HypermediaTypes.ResourceDescriptor {
  return {
    class: CHILD_CLASS,
    properties: { id: 'child-1', label: 'Child One' },
    ...overrides,
  }
}

function collectionDef(
  overrides: Partial<{
    itemClass: string
    searchTemplate: { template: string }
    href: string
    kind: 'canonical' | 'view'
    extraLinks: HAL.CollectionDefinitionRep['extraLinks']
    curiesBaseHref: string
    useSurfaceAsMemberCollection: boolean
  }> = {},
): HAL.CollectionDefinitionRep {
  return new HAL.CollectionDefinitionRep({
    itemClass: overrides.itemClass ?? ITEM_CLASS,
    searchTemplate: overrides.searchTemplate ?? {
      template: '/api/items{?q,cursor,limit}',
    },
    ...overrides,
  } as any)
}

function pageView(overrides: Partial<HypermediaTypes.PageView> = {}): HypermediaTypes.PageView {
  return { self: '/api/items?cursor=abc', first: '/api/items', ...overrides }
}
