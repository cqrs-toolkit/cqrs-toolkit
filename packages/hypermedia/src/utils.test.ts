import { describe, expect, it } from 'vitest'
import {
  assertNoQueryExpansionInTemplate,
  buildTemplateIri,
  deriveQueryVarsFromMappings,
  deriveRequestedProfilesRaw,
  hasExplicitReadProfileRaw,
  hasExplicitWriteProfileRaw,
  semverDesc,
  uriTemplatePathToColon,
} from './utils.js'

describe('utils', () => {
  describe('buildTemplateIri', () => {
    it('returns path only when no params', () => {
      expect(buildTemplateIri('/api/items')).toBe('/api/items')
    })

    it('returns path only when params is empty array', () => {
      expect(buildTemplateIri('/api/items', [])).toBe('/api/items')
    })

    it('appends query expansion suffix', () => {
      expect(buildTemplateIri('/api/items', ['q', 'limit'])).toBe('/api/items{?q,limit}')
    })

    it('asserts on duplicate parameters', () => {
      expect(() => buildTemplateIri('/api/items', ['q', 'q'])).toThrow(/duplicate/)
    })
  })

  describe('assertNoQueryExpansionInTemplate', () => {
    it('does not throw for clean template', () => {
      expect(() => assertNoQueryExpansionInTemplate('test', '/api/items/{id}')).not.toThrow()
    })

    it('asserts when template contains query expansion', () => {
      expect(() => assertNoQueryExpansionInTemplate('test', '/api/items{?q,limit}')).toThrow(
        /must NOT include/,
      )
    })
  })

  describe('deriveQueryVarsFromMappings', () => {
    it('separates query vars from path vars', () => {
      const result = deriveQueryVarsFromMappings('/api/items/{id}', [
        { variable: 'id', property: 'id' },
        { variable: 'q', property: 'q' },
        { variable: 'limit', property: 'limit' },
      ])
      expect(result).toEqual(['q', 'limit'])
    })

    it('preserves mapping order', () => {
      const result = deriveQueryVarsFromMappings('/api/items', [
        { variable: 'limit', property: 'limit' },
        { variable: 'q', property: 'q' },
      ])
      expect(result).toEqual(['limit', 'q'])
    })

    it('skips mappings with empty variable', () => {
      const result = deriveQueryVarsFromMappings('/api/items', [
        { variable: '', property: 'x' },
        { variable: 'q', property: 'q' },
      ])
      expect(result).toEqual(['q'])
    })

    it('asserts on duplicate mapping variables', () => {
      expect(() =>
        deriveQueryVarsFromMappings('/api/items', [
          { variable: 'q', property: 'q' },
          { variable: 'q', property: 'query' },
        ]),
      ).toThrow(/duplicate/)
    })

    it('returns empty array when all vars are path vars', () => {
      const result = deriveQueryVarsFromMappings('/api/items/{id}', [
        { variable: 'id', property: 'id' },
      ])
      expect(result).toEqual([])
    })
  })

  describe('deriveRequestedProfilesRaw', () => {
    it('parses Accept-Profile for GET', () => {
      const result = deriveRequestedProfilesRaw({
        method: 'GET',
        headers: { 'accept-profile': 'urn:profile:v1' },
      })
      expect(result).toEqual(['urn:profile:v1'])
    })

    it('parses Content-Profile for POST', () => {
      const result = deriveRequestedProfilesRaw({
        method: 'POST',
        headers: { 'content-profile': 'urn:profile:v1' },
      })
      expect(result).toEqual(['urn:profile:v1'])
    })

    it('parses profile param from Accept header for GET', () => {
      const result = deriveRequestedProfilesRaw({
        method: 'GET',
        headers: { accept: 'application/json; profile="urn:profile:v1"' },
      })
      expect(result).toEqual(['urn:profile:v1'])
    })

    it('parses profile param from Content-Type header for POST', () => {
      const result = deriveRequestedProfilesRaw({
        method: 'POST',
        headers: { 'content-type': 'application/json; profile="urn:profile:v1"' },
      })
      expect(result).toEqual(['urn:profile:v1'])
    })

    it('returns null when no profile headers present', () => {
      const result = deriveRequestedProfilesRaw({
        method: 'GET',
        headers: { accept: 'application/json' },
      })
      expect(result).toBeNull()
    })

    it('deduplicates profiles', () => {
      const result = deriveRequestedProfilesRaw({
        method: 'GET',
        headers: {
          'accept-profile': 'urn:profile:v1',
          accept: 'application/json; profile="urn:profile:v1"',
        },
      })
      expect(result).toEqual(['urn:profile:v1'])
    })

    it('handles comma-separated profiles', () => {
      const result = deriveRequestedProfilesRaw({
        method: 'GET',
        headers: { 'accept-profile': 'urn:a, urn:b' },
      })
      expect(result).toEqual(['urn:a', 'urn:b'])
    })

    it('handles header array values', () => {
      const result = deriveRequestedProfilesRaw({
        method: 'GET',
        headers: { 'accept-profile': ['urn:a', 'urn:b'] },
      })
      expect(result).toEqual(['urn:a', 'urn:b'])
    })

    it('strips quotes from profile values', () => {
      const result = deriveRequestedProfilesRaw({
        method: 'GET',
        headers: { 'accept-profile': '"urn:profile:v1"' },
      })
      expect(result).toEqual(['urn:profile:v1'])
    })

    it('handles underscore variant header names', () => {
      const result = deriveRequestedProfilesRaw({
        method: 'GET',
        headers: { accept_profile: 'urn:profile:v1' },
      })
      expect(result).toEqual(['urn:profile:v1'])
    })
  })

  describe('hasExplicitReadProfileRaw', () => {
    it('returns true when Accept-Profile is present', () => {
      expect(
        hasExplicitReadProfileRaw({
          headers: { 'accept-profile': 'urn:profile:v1' },
        }),
      ).toBe(true)
    })

    it('returns true when Accept has profile param', () => {
      expect(
        hasExplicitReadProfileRaw({
          headers: { accept: 'application/json; profile="urn:profile:v1"' },
        }),
      ).toBe(true)
    })

    it('returns false when neither is present', () => {
      expect(
        hasExplicitReadProfileRaw({
          headers: { accept: 'application/json' },
        }),
      ).toBe(false)
    })
  })

  describe('hasExplicitWriteProfileRaw', () => {
    it('returns true when Content-Profile is present', () => {
      expect(
        hasExplicitWriteProfileRaw({
          headers: { 'content-profile': 'urn:profile:v1' },
        }),
      ).toBe(true)
    })

    it('returns true when Content-Type has profile param', () => {
      expect(
        hasExplicitWriteProfileRaw({
          headers: { 'content-type': 'application/json; profile="urn:profile:v1"' },
        }),
      ).toBe(true)
    })

    it('returns false when neither is present', () => {
      expect(
        hasExplicitWriteProfileRaw({
          headers: { 'content-type': 'application/json' },
        }),
      ).toBe(false)
    })
  })

  describe('uriTemplatePathToColon', () => {
    it('converts single path var', () => {
      expect(uriTemplatePathToColon('/api/{id}')).toBe('/api/:id')
    })

    it('converts multiple path vars', () => {
      expect(uriTemplatePathToColon('/api/{roomId}/messages/{id}')).toBe(
        '/api/:roomId/messages/:id',
      )
    })

    it('leaves paths without vars unchanged', () => {
      expect(uriTemplatePathToColon('/api/items')).toBe('/api/items')
    })

    it('does not convert query expansion vars', () => {
      expect(uriTemplatePathToColon('/api/items{?q}')).toBe('/api/items{?q}')
    })
  })

  describe('semverDesc', () => {
    it('returns negative when a > b (descending sort)', () => {
      expect(semverDesc('2.0.0', '1.0.0')).toBeLessThan(0)
    })

    it('returns positive when a < b', () => {
      expect(semverDesc('1.0.0', '2.0.0')).toBeGreaterThan(0)
    })

    it('returns 0 for equal versions', () => {
      expect(semverDesc('1.0.0', '1.0.0')).toBe(0)
    })

    it('compares minor and patch correctly', () => {
      expect(semverDesc('1.2.0', '1.1.0')).toBeLessThan(0)
      expect(semverDesc('1.0.1', '1.0.0')).toBeLessThan(0)
    })
  })
})
