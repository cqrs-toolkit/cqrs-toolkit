import { describe, expect, it } from 'vitest'
import type { SchemaUrnResolver } from '../cli/config-types.js'
import { buildSchemaUrnToUrlMapper } from './utils.js'

describe('buildSchemaUrnToUrlMapper', () => {
  const docsEntrypoint = 'http://localhost:3002/api/meta'
  const mapUrnToUrl = (urn: string) => `${urn.replaceAll(':', '/')}.json`
  const isUrn = (v: string) => v.startsWith('urn:')

  describe('pathSegment normalization', () => {
    it('handles simple pathSegment', () => {
      const resolver: SchemaUrnResolver = { pathSegment: 'schemas', isUrn, mapUrnToUrl }
      const mapper = buildSchemaUrnToUrlMapper(docsEntrypoint, resolver)
      expect(mapper('urn:schema:nb.Todo:1.0.0')).toBe(
        'http://localhost:3002/api/meta/schemas/urn/schema/nb.Todo/1.0.0.json',
      )
    })

    it('handles nested pathSegment', () => {
      const resolver: SchemaUrnResolver = {
        pathSegment: 'components/schemas',
        isUrn,
        mapUrnToUrl,
      }
      const mapper = buildSchemaUrnToUrlMapper(docsEntrypoint, resolver)
      expect(mapper('urn:schema:nb.Todo:1.0.0')).toBe(
        'http://localhost:3002/api/meta/components/schemas/urn/schema/nb.Todo/1.0.0.json',
      )
    })

    it('strips leading slash from pathSegment', () => {
      const resolver: SchemaUrnResolver = { pathSegment: '/schemas', isUrn, mapUrnToUrl }
      const mapper = buildSchemaUrnToUrlMapper(docsEntrypoint, resolver)
      expect(mapper('urn:schema:nb.Todo:1.0.0')).toBe(
        'http://localhost:3002/api/meta/schemas/urn/schema/nb.Todo/1.0.0.json',
      )
    })

    it('strips trailing slash from pathSegment', () => {
      const resolver: SchemaUrnResolver = { pathSegment: 'schemas/', isUrn, mapUrnToUrl }
      const mapper = buildSchemaUrnToUrlMapper(docsEntrypoint, resolver)
      expect(mapper('urn:schema:nb.Todo:1.0.0')).toBe(
        'http://localhost:3002/api/meta/schemas/urn/schema/nb.Todo/1.0.0.json',
      )
    })

    it('strips both leading and trailing slashes', () => {
      const resolver: SchemaUrnResolver = { pathSegment: '/schemas/', isUrn, mapUrnToUrl }
      const mapper = buildSchemaUrnToUrlMapper(docsEntrypoint, resolver)
      expect(mapper('urn:schema:nb.Todo:1.0.0')).toBe(
        'http://localhost:3002/api/meta/schemas/urn/schema/nb.Todo/1.0.0.json',
      )
    })
  })

  it('returns identity when schemaUrnResolver is undefined', () => {
    const mapper = buildSchemaUrnToUrlMapper(docsEntrypoint, undefined)
    expect(mapper('urn:schema:nb.Todo:1.0.0')).toBe('urn:schema:nb.Todo:1.0.0')
  })
})
