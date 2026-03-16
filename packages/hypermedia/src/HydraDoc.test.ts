import { describe, expect, it } from 'vitest'
import {
  collectionSurface,
  multiVersionDef,
  plainRepresentation,
  resourceSurface,
  singleVersionDef,
} from './HydraDoc.fixtures.js'
import { HydraDoc } from './HydraDoc.js'

describe('HydraDoc', () => {
  describe('IriTemplate', () => {
    it('derives query expansion from mappings', () => {
      const tpl = new HydraDoc.IriTemplate('test', '/api/items', [
        { variable: 'q', property: 'q' },
        { variable: 'limit', property: 'limit' },
      ])
      expect(tpl.template).toBe('/api/items{?q,limit}')
    })

    it('excludes path vars from query expansion', () => {
      const tpl = new HydraDoc.IriTemplate('test', '/api/items/{id}', [
        { variable: 'id', property: 'id' },
        { variable: 'q', property: 'q' },
      ])
      expect(tpl.template).toBe('/api/items/{id}{?q}')
    })

    it('asserts when template contains query expansion', () => {
      expect(
        () =>
          new HydraDoc.IriTemplate('test', '/api/items{?q}' as any, [
            { variable: 'q', property: 'q' },
          ]),
      ).toThrow(/must NOT include/)
    })

    it('baseHref strips query expansion', () => {
      const tpl = new HydraDoc.IriTemplate('test', '/api/items', [{ variable: 'q', property: 'q' }])
      expect(tpl.baseHref()).toBe('/api/items')
    })

    it('hasQueryExpansion returns true when template has query vars', () => {
      const tpl = new HydraDoc.IriTemplate('test', '/api/items', [{ variable: 'q', property: 'q' }])
      expect(tpl.hasQueryExpansion()).toBe(true)
    })

    it('hasQueryExpansion returns false when template has no query vars', () => {
      const tpl = new HydraDoc.IriTemplate('test', '/api/items/{id}', [
        { variable: 'id', property: 'id' },
      ])
      expect(tpl.hasQueryExpansion()).toBe(false)
    })
  })

  describe('QuerySurface', () => {
    it('derives hrefBase from template when href is not provided', () => {
      const surface = new HydraDoc.QuerySurface(resourceSurface())
      expect(surface.hrefBase).toBe('/api/items/{id}')
    })

    it('uses explicit href when provided', () => {
      const surface = new HydraDoc.QuerySurface(collectionSurface({ href: '/api/custom-items' }))
      expect(surface.hrefBase).toBe('/api/custom-items')
    })

    it('toHalCollectionLinks returns collection and search links', () => {
      const surface = new HydraDoc.QuerySurface(collectionSurface())
      const links = surface.toHalCollectionLinks()
      expect(links.collection.href).toBe('/api/items')
      expect(links.search.href).toBe('/api/items{?q,limit,cursor}')
      expect(links.search.templated).toBe(true)
    })

    it('toHalItemLinks returns collection link only', () => {
      const surface = new HydraDoc.QuerySurface(collectionSurface())
      const links = surface.toHalItemLinks()
      expect(links.collection.href).toBe('/api/items')
    })
  })

  describe('Representation', () => {
    it('constructs resource and collection QuerySurfaces', () => {
      const rep = new HydraDoc.Representation(plainRepresentation())
      expect(rep.resource).toBeInstanceOf(HydraDoc.QuerySurface)
      expect(rep.collection).toBeInstanceOf(HydraDoc.QuerySurface)
    })

    it('exposes resourceHref and collectionHref', () => {
      const rep = new HydraDoc.Representation(plainRepresentation())
      expect(rep.resourceHref).toBe('/api/items/{id}')
      expect(rep.collectionHref).toBe('/api/items')
    })

    it('asserts when collection template has no query expansion', () => {
      expect(
        () =>
          new HydraDoc.Representation(
            plainRepresentation({
              collection: collectionSurface({
                template: {
                  id: 'test',
                  template: '/api/items/{id}',
                  mappings: [{ variable: 'id', property: 'id' }],
                },
              }),
            }),
          ),
      ).toThrow(/query expansion/)
    })

    it('builds itemEvents surface when events.item is provided', () => {
      const rep = new HydraDoc.Representation({
        ...plainRepresentation(),
        events: {
          baseHref: '/api',
          resourceSegment: 'items',
          item: { profile: 'urn:profile:test.ItemEvents:1.0.0' },
        },
      })
      expect(rep.itemEvents).toBeInstanceOf(HydraDoc.QuerySurface)
      expect(rep.itemEvents!.hrefBase).toBe('/api/items/{id}/events')
    })

    it('builds aggregateEvents surface when events.aggregate is provided', () => {
      const rep = new HydraDoc.Representation({
        ...plainRepresentation(),
        events: {
          baseHref: '/api',
          resourceSegment: 'items',
          item: { profile: 'urn:profile:test.ItemEvents:1.0.0' },
          aggregate: { profile: 'urn:profile:test.ItemAggEvents:1.0.0' },
        },
      })
      expect(rep.aggregateEvents).toBeInstanceOf(HydraDoc.QuerySurface)
      expect(rep.aggregateEvents!.hrefBase).toBe('/api/events/items')
    })

    it('sets events to undefined when events is absent', () => {
      const rep = new HydraDoc.Representation(plainRepresentation())
      expect(rep.itemEvents).toBeUndefined()
      expect(rep.aggregateEvents).toBeUndefined()
    })

    it('uses explicit events id when provided', () => {
      const rep = new HydraDoc.Representation({
        ...plainRepresentation(),
        events: {
          baseHref: '/api',
          resourceSegment: 'items',
          item: { id: 'custom-item-events', profile: 'urn:profile:test.ItemEvents:1.0.0' },
        },
      })
      expect(rep.itemEvents!.template.id).toBe('custom-item-events')
    })
  })

  describe('ViewRepresentation', () => {
    it('reuses base resource surface', () => {
      const base = new HydraDoc.Representation(plainRepresentation())
      const view = new HydraDoc.ViewRepresentation({
        id: '#test-view-v1_0_0',
        version: '1.0.0',
        base,
        collection: collectionSurface({ href: '/api/scoped-items' }),
      })
      expect(view.resource).toBe(base.resource)
    })

    it('creates own collection surface', () => {
      const base = new HydraDoc.Representation(plainRepresentation())
      const view = new HydraDoc.ViewRepresentation({
        id: '#test-view-v1_0_0',
        version: '1.0.0',
        base,
        collection: collectionSurface({ href: '/api/scoped-items' }),
      })
      expect(view.collection).not.toBe(base.collection)
      expect(view.collectionHref).toBe('/api/scoped-items')
    })

    it('toHalItemLinks returns collection pointing to view collection', () => {
      const base = new HydraDoc.Representation(plainRepresentation())
      const view = new HydraDoc.ViewRepresentation({
        id: '#test-view-v1_0_0',
        version: '1.0.0',
        base,
        collection: collectionSurface({ href: '/api/scoped-items' }),
      })
      const links = view.toHalItemLinks()
      expect(links.collection.href).toBe('/api/scoped-items')
    })

    it('asserts when collection template has no query expansion', () => {
      const base = new HydraDoc.Representation(plainRepresentation())
      expect(
        () =>
          new HydraDoc.ViewRepresentation({
            id: '#test-view-v1_0_0',
            version: '1.0.0',
            base,
            collection: collectionSurface({
              template: {
                id: 'test',
                template: '/api/items/{id}',
                mappings: [{ variable: 'id', property: 'id' }],
              },
            }),
          }),
      ).toThrow(/query expansion/)
    })
  })

  describe('CommandsDef.getStableId', () => {
    it('maps commandType to stableId', () => {
      const def = singleVersionDef()
      expect(def.getStableId('rename')).toBe('test.RenameItem')
    })

    it('asserts on unknown commandType', () => {
      const def = singleVersionDef()
      expect(() => def.getStableId('nonexistent')).toThrow('no command found')
    })
  })

  describe('CommandCapability — version and isLatest', () => {
    it('parses version from URN', () => {
      const def = singleVersionDef()
      const cmd = def.commands.find((c) => c.id === 'urn:command:test.RenameItem:1.0.0')
      expect(cmd?.version).toBe('1.0.0')
    })

    it('marks standalone command (no stableId group) as isLatest', () => {
      const def = singleVersionDef()
      const rename = def.commands.find((c) => c.id === 'urn:command:test.RenameItem:1.0.0')
      expect(rename?.isLatest).toBe(true)
      const create = def.commands.find((c) => c.id === 'urn:command:test.CreateItem:1.0.0')
      expect(create?.isLatest).toBe(true)
    })

    it('marks only highest semver as isLatest in multi-version group', () => {
      const def = multiVersionDef()
      const v1 = def.commands.find((c) => c.id === 'urn:command:test.RenameItem:1.0.0')
      const v2 = def.commands.find((c) => c.id === 'urn:command:test.RenameItem:2.0.0')
      expect(v1?.isLatest).toBe(false)
      expect(v2?.isLatest).toBe(true)

      // CreateItem is standalone — should still be latest
      const create = def.commands.find((c) => c.id === 'urn:command:test.CreateItem:1.0.0')
      expect(create?.isLatest).toBe(true)
    })
  })

  describe('standardCommandSurfaces', () => {
    it('produces create and command surfaces', () => {
      const surfaces = HydraDoc.standardCommandSurfaces({
        idStem: 'test-item',
        collectionHref: '/api/items',
        idProperty: 'itemId',
      })
      expect(surfaces).toHaveLength(2)
      expect(surfaces[0]!.dispatch).toBe('create')
      expect(surfaces[1]!.dispatch).toBe('command')
    })
  })

  describe('standardCreateCommandSurface', () => {
    it('produces POST to collectionHref', () => {
      const surface = HydraDoc.standardCreateCommandSurface({
        idStem: 'test-item',
        collectionHref: '/api/items',
      })
      expect(surface.dispatch).toBe('create')
      expect(surface.method).toBe('POST')
      expect(surface.template.template).toBe('/api/items')
    })
  })

  describe('standardCommandSurface', () => {
    it('produces POST to collectionHref/{id}/command', () => {
      const surface = HydraDoc.standardCommandSurface({
        idStem: 'test-item',
        collectionHref: '/api/items',
        idProperty: 'itemId',
      })
      expect(surface.dispatch).toBe('command')
      expect(surface.template.template).toBe('/api/items/{id}/command')
    })

    it('includes id mapping as required', () => {
      const surface = HydraDoc.standardCommandSurface({
        idStem: 'test-item',
        collectionHref: '/api/items',
        idProperty: 'itemId',
      })
      const idMapping = surface.template.mappings.find((m) => m.variable === 'id')
      expect(idMapping).toBeDefined()
      expect(idMapping!.required).toBe(true)
      expect(idMapping!.property).toBe('itemId')
    })
  })
})
