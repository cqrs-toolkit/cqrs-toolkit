import type { JSONSchema7 } from 'json-schema'
import assert from 'node:assert'
import { describe, expect, it } from 'vitest'
import { findSchemaPathTarget, replaceSchemaAtPath } from './schema-path.js'

const REPLACEMENT: JSONSchema7 = { $ref: '#/definitions/__External_EntityId' }

function mk(): JSONSchema7 {
  return {
    type: 'object',
    properties: {
      id: { type: 'string' },
      notebookId: { type: 'string' },
      nested: {
        type: 'object',
        properties: { inner: { type: 'string' } },
      },
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: { childId: { type: 'string' } },
        },
      },
    },
  }
}

describe('schema-path', () => {
  it('replaces a top-level member', () => {
    const s = mk()
    replaceSchemaAtPath(s, '$.notebookId', REPLACEMENT)
    expect(s.properties?.['notebookId']).toEqual(REPLACEMENT)
    expect(s.properties?.['id']).toEqual({ type: 'string' })
  })

  it('replaces via bracket-member syntax', () => {
    const s = mk()
    replaceSchemaAtPath(s, "$['notebookId']", REPLACEMENT)
    expect(s.properties?.['notebookId']).toEqual(REPLACEMENT)
  })

  it('replaces a nested member', () => {
    const s = mk()
    replaceSchemaAtPath(s, '$.nested.inner', REPLACEMENT)
    const nested = s.properties?.['nested'] as JSONSchema7
    expect(nested.properties?.['inner']).toEqual(REPLACEMENT)
  })

  it('replaces items via wildcard', () => {
    const s = mk()
    replaceSchemaAtPath(s, '$.items[*]', REPLACEMENT)
    const items = s.properties?.['items'] as JSONSchema7
    expect(items.items).toEqual(REPLACEMENT)
  })

  it('replaces items via index (treats [n] same as [*])', () => {
    const s = mk()
    replaceSchemaAtPath(s, '$.items[0]', REPLACEMENT)
    const items = s.properties?.['items'] as JSONSchema7
    expect(items.items).toEqual(REPLACEMENT)
  })

  it('navigates into array items then replaces a member on the element schema', () => {
    const s = mk()
    replaceSchemaAtPath(s, '$.items[*].childId', REPLACEMENT)
    const items = s.properties?.['items'] as JSONSchema7
    const elem = items.items as JSONSchema7
    expect(elem.properties?.['childId']).toEqual(REPLACEMENT)
  })

  it('throws on a missing property', () => {
    const s = mk()
    expect(() => replaceSchemaAtPath(s, '$.nonexistent', REPLACEMENT)).toThrowError(
      /does not exist/,
    )
  })

  it('throws when navigating into a schema with no `properties`', () => {
    const s: JSONSchema7 = { type: 'string' }
    expect(() => replaceSchemaAtPath(s, '$.foo', REPLACEMENT)).toThrowError(/no 'properties'/)
  })

  it('throws on tuple-style items arrays', () => {
    const s: JSONSchema7 = {
      type: 'object',
      properties: {
        tuple: { type: 'array', items: [{ type: 'string' }, { type: 'number' }] },
      },
    }
    expect(() => replaceSchemaAtPath(s, '$.tuple[*]', REPLACEMENT)).toThrowError(/tuple-style/)
  })

  it('throws on root-only path', () => {
    const s = mk()
    expect(() => replaceSchemaAtPath(s, '$', REPLACEMENT)).toThrowError(/root schema/)
  })

  it('findSchemaPathTarget exposes the parent/key slot without mutating', () => {
    const s = mk()
    const target = findSchemaPathTarget(s, '$.notebookId')
    assert(target.kind === 'property')
    expect(target.key).toBe('notebookId')
    expect(s.properties?.['notebookId']).toEqual({ type: 'string' })
    target.parent[target.key] = REPLACEMENT
    expect(s.properties?.['notebookId']).toEqual(REPLACEMENT)
  })

  it('parses a path with a property name containing a hyphen via bracket form', () => {
    const s: JSONSchema7 = {
      type: 'object',
      properties: { 'foo-bar': { type: 'string' } },
    }
    replaceSchemaAtPath(s, "$['foo-bar']", REPLACEMENT)
    expect(s.properties?.['foo-bar']).toEqual(REPLACEMENT)
  })
})
