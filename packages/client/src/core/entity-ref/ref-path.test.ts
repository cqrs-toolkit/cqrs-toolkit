import { describe, expect, it } from 'vitest'
import { createEntityRef, isEntityRef } from '../../types/entities.js'
import {
  extractTopLevelEntityRefs,
  findMatchingPaths,
  getAtPath,
  getValuesAtPath,
  pathHasWildcard,
  resolveRefPaths,
  setAtPath,
  stripEntityRefs,
  validatePath,
} from './ref-path.js'

const ref1 = createEntityRef('entity-1', 'cmd-1', 'temporary')
const ref2 = createEntityRef('entity-2', 'cmd-2', 'temporary')
const ref3 = createEntityRef('entity-3', 'cmd-3', 'permanent')

describe('getAtPath', () => {
  it('reads a top-level field', () => {
    expect(getAtPath({ name: 'hello' }, '$.name')).toBe('hello')
  })

  it('reads a nested field', () => {
    expect(getAtPath({ a: { b: 42 } }, '$.a.b')).toBe(42)
  })

  it('reads with bracket notation', () => {
    expect(getAtPath({ 'special-key': 'val' }, "$['special-key']")).toBe('val')
  })

  it('reads an array element', () => {
    expect(getAtPath({ items: ['a', 'b', 'c'] }, '$.items[1]')).toBe('b')
  })

  it('reads a nested array element field', () => {
    const data = { forms: [{ id: 'f1' }, { id: 'f2' }] }
    expect(getAtPath(data, '$.forms[0].id')).toBe('f1')
    expect(getAtPath(data, '$.forms[1].id')).toBe('f2')
  })

  it('returns undefined for missing path', () => {
    expect(getAtPath({ a: 1 }, '$.b')).toBeUndefined()
  })

  it('returns undefined for non-object intermediate', () => {
    expect(getAtPath({ a: 'string' }, '$.a.b')).toBeUndefined()
  })

  it('throws on wildcard', () => {
    expect(() => getAtPath({ items: [1] }, '$.items[*]')).toThrow('wildcard')
  })

  it('reads a bracket member whose key contains a dot', () => {
    // Canonical embed key shape: HAL-style `_embedded["pms.Asset"]`.
    const data = { _embedded: { 'pms.Asset': { id: 'asset-1' } } }
    expect(getAtPath(data, "$._embedded['pms.Asset']")).toEqual({ id: 'asset-1' })
  })

  it('reads a dot member chained after a bracket member with a dotted key', () => {
    // The full canonical join-source `referencedIdPath` for projects-with-assets.
    const data = { _embedded: { 'pms.Asset': { id: 'asset-1', name: 'A' } } }
    expect(getAtPath(data, "$._embedded['pms.Asset'].id")).toBe('asset-1')
  })

  it('reads through bracket-then-array-index chain', () => {
    const data = { _embedded: { 'pms.Asset.list': [{ id: 'a' }, { id: 'b' }] } }
    expect(getAtPath(data, "$._embedded['pms.Asset.list'][1].id")).toBe('b')
  })

  it('returns undefined for missing bracket-member key', () => {
    const data = { _embedded: {} }
    expect(getAtPath(data, "$._embedded['pms.Asset'].id")).toBeUndefined()
  })

  it('handles bracket keys with whitespace', () => {
    const data = { 'key with spaces': 'val' }
    expect(getAtPath(data, "$['key with spaces']")).toBe('val')
  })

  it('reads a bracket member with double-quoted key', () => {
    // RFC 9535 name-selector accepts both single and double quotes.
    const data = { _embedded: { 'pms.Asset': { id: 'asset-1' } } }
    expect(getAtPath(data, '$._embedded["pms.Asset"].id')).toBe('asset-1')
  })

  it('throws on mismatched bracket quotes', () => {
    expect(() => getAtPath({}, `$._embedded['pms.Asset"]`)).toThrow('Unterminated bracket member')
    expect(() => getAtPath({}, `$._embedded["pms.Asset']`)).toThrow('Unterminated bracket member')
  })
})

describe('validatePath', () => {
  it('accepts single-quoted bracket members', () => {
    expect(() => validatePath("$._embedded['pms.Asset'].id")).not.toThrow()
  })

  it('accepts double-quoted bracket members', () => {
    expect(() => validatePath('$._embedded["pms.Asset"].id')).not.toThrow()
  })

  it('rejects mismatched bracket quotes', () => {
    expect(() => validatePath(`$._embedded['pms.Asset"]`)).toThrow('Unterminated bracket member')
  })

  it('rejects paths missing the $ root', () => {
    expect(() => validatePath('_embedded.id')).toThrow('must start with $')
  })

  it('rejects empty member names', () => {
    expect(() => validatePath('$..name')).toThrow('Empty member name')
  })
})

describe('pathHasWildcard', () => {
  it('returns false for paths with no wildcards', () => {
    expect(pathHasWildcard('$.foo.bar')).toBe(false)
    expect(pathHasWildcard("$._embedded['pms.Asset'].id")).toBe(false)
    expect(pathHasWildcard('$.items[3].id')).toBe(false)
  })

  it('returns true for paths containing [*]', () => {
    expect(pathHasWildcard('$.tagIds[*]')).toBe(true)
    expect(pathHasWildcard('$.tags[*].id')).toBe(true)
    expect(pathHasWildcard('$.a[*].b[*].id')).toBe(true)
  })
})

describe('getValuesAtPath', () => {
  it('returns a single-element list for a wildcard-free path that resolves', () => {
    expect(getValuesAtPath({ a: { b: 'x' } }, '$.a.b')).toEqual(['x'])
  })

  it('returns an empty list when a wildcard-free path does not resolve', () => {
    expect(getValuesAtPath({ a: {} }, '$.a.b')).toEqual([])
    expect(getValuesAtPath({}, '$.a.b')).toEqual([])
  })

  it('returns each array element for a `[*]` tail', () => {
    expect(getValuesAtPath({ tagIds: ['a', 'b', 'c'] }, '$.tagIds[*]')).toEqual(['a', 'b', 'c'])
  })

  it('returns the navigated field per element for `[*].field`', () => {
    const data = {
      tags: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ],
    }
    expect(getValuesAtPath(data, '$.tags[*].id')).toEqual(['a', 'b'])
  })

  it('returns an empty list when the array is missing or empty', () => {
    expect(getValuesAtPath({}, '$.tagIds[*]')).toEqual([])
    expect(getValuesAtPath({ tagIds: [] }, '$.tagIds[*]')).toEqual([])
  })

  it('skips elements whose subpath does not resolve', () => {
    const data = { tags: [{ id: 'a' }, { other: 'no-id-here' }, { id: 'c' }] }
    expect(getValuesAtPath(data, '$.tags[*].id')).toEqual(['a', 'c'])
  })

  it('returns object values verbatim — caller is responsible for type-narrowing', () => {
    const ref = { entityId: 'srv-1', commandId: 'cmd-1', state: 'temporary' }
    const data = { tagIds: [ref, 'plain-string'] }
    expect(getValuesAtPath(data, '$.tagIds[*]')).toEqual([ref, 'plain-string'])
  })
})

describe('setAtPath', () => {
  it('sets a top-level field', () => {
    expect(setAtPath({ a: 1, b: 2 }, '$.a', 99)).toEqual({ a: 99, b: 2 })
  })

  it('sets a nested field', () => {
    expect(setAtPath({ a: { b: 1, c: 2 } }, '$.a.b', 99)).toEqual({ a: { b: 99, c: 2 } })
  })

  it('sets with bracket notation', () => {
    expect(setAtPath({ 'x.y': 1 }, "$['x.y']", 99)).toEqual({ 'x.y': 99 })
  })

  it('sets an array element', () => {
    expect(setAtPath({ items: ['a', 'b', 'c'] }, '$.items[1]', 'X')).toEqual({
      items: ['a', 'X', 'c'],
    })
  })

  it('sets a nested array element field', () => {
    const data = {
      forms: [
        { id: 'f1', name: 'a' },
        { id: 'f2', name: 'b' },
      ],
    }
    const result = setAtPath(data, '$.forms[0].id', 'new-id')
    expect(result).toEqual({
      forms: [
        { id: 'new-id', name: 'a' },
        { id: 'f2', name: 'b' },
      ],
    })
  })

  it('does not mutate the original object', () => {
    const original = { a: { b: 1 } }
    const result = setAtPath(original, '$.a.b', 99)
    expect(original.a.b).toBe(1)
    expect(result).toEqual({ a: { b: 99 } })
  })

  it('creates intermediate objects if missing', () => {
    expect(setAtPath({}, '$.a.b', 1)).toEqual({ a: { b: 1 } })
  })

  it('sets through bracket member with a dotted key', () => {
    const data = { _embedded: { 'pms.Asset': { id: 'old' } } }
    expect(setAtPath(data, "$._embedded['pms.Asset'].id", 'new')).toEqual({
      _embedded: { 'pms.Asset': { id: 'new' } },
    })
  })
})

describe('findMatchingPaths', () => {
  it('returns a single concrete path for a non-wildcard pattern', () => {
    const data = { notebookId: 'nb-1' }
    const result = findMatchingPaths(data, '$.notebookId', (v) => v === 'nb-1')
    expect(result).toEqual([{ path: '$.notebookId', value: 'nb-1' }])
  })

  it('returns empty when predicate does not match', () => {
    const data = { notebookId: 'nb-1' }
    const result = findMatchingPaths(data, '$.notebookId', (v) => v === 'other')
    expect(result).toEqual([])
  })

  it('returns empty when path does not resolve', () => {
    const data = { other: 'value' }
    const result = findMatchingPaths(data, '$.notebookId', () => true)
    expect(result).toEqual([])
  })

  it('expands a wildcard over array elements and filters by predicate', () => {
    const data = {
      attachments: [
        { fileObjectId: 'file-1' },
        { fileObjectId: 'file-2' },
        { fileObjectId: 'file-3' },
      ],
    }
    const result = findMatchingPaths(data, '$.attachments[*].fileObjectId', (v) => v === 'file-2')
    expect(result).toEqual([{ path: '$.attachments[1].fileObjectId', value: 'file-2' }])
  })

  it('returns multiple matches when several elements satisfy the predicate', () => {
    const data = {
      attachments: [
        { fileObjectId: 'target' },
        { fileObjectId: 'other' },
        { fileObjectId: 'target' },
      ],
    }
    const result = findMatchingPaths(data, '$.attachments[*].fileObjectId', (v) => v === 'target')
    expect(result).toEqual([
      { path: '$.attachments[0].fileObjectId', value: 'target' },
      { path: '$.attachments[2].fileObjectId', value: 'target' },
    ])
  })

  it('expands nested wildcards', () => {
    const data = {
      sections: [{ items: [{ parentId: 'a' }, { parentId: 'b' }] }, { items: [{ parentId: 'a' }] }],
    }
    const result = findMatchingPaths(data, '$.sections[*].items[*].parentId', (v) => v === 'a')
    expect(result).toEqual([
      { path: '$.sections[0].items[0].parentId', value: 'a' },
      { path: '$.sections[1].items[0].parentId', value: 'a' },
    ])
  })

  it('returns matches against EntityRef values via isEntityRef predicate', () => {
    const data = { forms: [{ id: ref1 }, { id: 'plain' }, { id: ref2 }] }
    const result = findMatchingPaths(data, '$.forms[*].id', isEntityRef)
    expect(result).toEqual([
      { path: '$.forms[0].id', value: ref1 },
      { path: '$.forms[2].id', value: ref2 },
    ])
  })

  it('matches Link objects via a structural predicate', () => {
    const data = {
      assignee: { service: 'auth', type: 'User', id: 'user-1' },
    }
    const result = findMatchingPaths(
      data,
      '$.assignee',
      (v) =>
        typeof v === 'object' &&
        v !== null &&
        'type' in v &&
        (v as { type: unknown }).type === 'User',
    )
    expect(result).toEqual([
      { path: '$.assignee', value: { service: 'auth', type: 'User', id: 'user-1' } },
    ])
  })

  it('skips wildcard on a non-array value', () => {
    const data = { attachments: 'not-an-array' }
    const result = findMatchingPaths(data, '$.attachments[*].id', () => true)
    expect(result).toEqual([])
  })

  it('skips missing intermediate paths', () => {
    const data = { a: 1 }
    const result = findMatchingPaths(data, '$.b.c.d', () => true)
    expect(result).toEqual([])
  })

  it('returned paths can be used with setAtPath', () => {
    const data = {
      attachments: [{ fileObjectId: 'old' }, { fileObjectId: 'keep' }, { fileObjectId: 'old' }],
    }
    const matches = findMatchingPaths(data, '$.attachments[*].fileObjectId', (v) => v === 'old')
    let updated: unknown = data
    for (const { path } of matches) {
      updated = setAtPath(updated, path, 'new')
    }
    expect(updated).toEqual({
      attachments: [{ fileObjectId: 'new' }, { fileObjectId: 'keep' }, { fileObjectId: 'new' }],
    })
  })

  it('does not mutate the original data', () => {
    const data = { items: [{ id: 'a' }, { id: 'b' }] }
    findMatchingPaths(data, '$.items[*].id', () => true)
    expect(data).toEqual({ items: [{ id: 'a' }, { id: 'b' }] })
  })
})

describe('resolveRefPaths', () => {
  it('resolves a simple dot path', () => {
    const data = { metadata: { orgId: ref1 } }
    const result = resolveRefPaths(data, ['$.metadata.orgId'])
    expect(result).toEqual({ '$.metadata.orgId': ref1 })
  })

  it('resolves a bracket path', () => {
    const data = { '@context': { id: ref1 } }
    const result = resolveRefPaths(data, ["$['@context'].id"])
    expect(result).toEqual({ "$['@context'].id": ref1 })
  })

  it('expands wildcard over array elements', () => {
    const data = { forms: [{ id: ref1 }, { id: ref2 }, { id: 'plain-string' }] }
    const result = resolveRefPaths(data, ['$.forms[*].id'])
    expect(result).toEqual({
      '$.forms[0].id': ref1,
      '$.forms[1].id': ref2,
      // [2] is a plain string, not EntityRef — skipped
    })
  })

  it('expands nested wildcards', () => {
    const data = {
      sections: [
        { items: [{ parentId: ref1 }, { parentId: 'str' }] },
        { items: [{ parentId: ref2 }] },
      ],
    }
    const result = resolveRefPaths(data, ['$.sections[*].items[*].parentId'])
    expect(result).toEqual({
      '$.sections[0].items[0].parentId': ref1,
      '$.sections[1].items[0].parentId': ref2,
    })
  })

  it('skips wildcard on non-array value', () => {
    const data = { forms: 'not-an-array' }
    const result = resolveRefPaths(data, ['$.forms[*].id'])
    expect(result).toEqual({})
  })

  it('skips missing intermediate paths', () => {
    const data = { a: 1 }
    const result = resolveRefPaths(data, ['$.b.c.d'])
    expect(result).toEqual({})
  })

  it('resolves multiple patterns', () => {
    const data = { orgId: ref1, items: [{ id: ref2 }] }
    const result = resolveRefPaths(data, ['$.orgId', '$.items[*].id'])
    expect(result).toEqual({
      '$.orgId': ref1,
      '$.items[0].id': ref2,
    })
  })
})

describe('extractTopLevelEntityRefs', () => {
  it('extracts EntityRef values from top-level fields', () => {
    const data = { notebookId: ref1, title: 'hello', orgId: ref2 }
    const result = extractTopLevelEntityRefs(data)
    expect(result).toEqual({
      '$.notebookId': ref1,
      '$.orgId': ref2,
    })
  })

  it('skips non-EntityRef values', () => {
    const data = { id: 'plain-string', count: 42, nested: { ref: ref1 } }
    const result = extractTopLevelEntityRefs(data)
    expect(result).toEqual({})
  })

  it('returns empty for non-object data', () => {
    expect(extractTopLevelEntityRefs('string')).toEqual({})
    expect(extractTopLevelEntityRefs(null)).toEqual({})
    expect(extractTopLevelEntityRefs(undefined)).toEqual({})
  })

  it('returns empty for object with no EntityRef values', () => {
    expect(extractTopLevelEntityRefs({ a: 1, b: 'two' })).toEqual({})
  })
})

describe('stripEntityRefs', () => {
  it('replaces EntityRef values with entityId strings', () => {
    const data = { notebookId: ref1, title: 'hello' }
    const commandIdPaths = { '$.notebookId': ref1 }
    const result = stripEntityRefs(data, commandIdPaths)
    expect(result).toEqual({ notebookId: 'entity-1', title: 'hello' })
  })

  it('handles multiple replacements', () => {
    const data = { orgId: ref1, deptId: ref2, name: 'test' }
    const commandIdPaths = { '$.orgId': ref1, '$.deptId': ref2 }
    const result = stripEntityRefs(data, commandIdPaths)
    expect(result).toEqual({ orgId: 'entity-1', deptId: 'entity-2', name: 'test' })
  })

  it('handles nested paths', () => {
    const data = { metadata: { orgId: ref1 } }
    const commandIdPaths = { '$.metadata.orgId': ref1 }
    const result = stripEntityRefs(data, commandIdPaths)
    expect(result).toEqual({ metadata: { orgId: 'entity-1' } })
  })

  it('handles array paths', () => {
    const data = { forms: [{ id: ref1 }, { id: ref2 }] }
    const commandIdPaths = { '$.forms[0].id': ref1, '$.forms[1].id': ref2 }
    const result = stripEntityRefs(data, commandIdPaths)
    expect(result).toEqual({ forms: [{ id: 'entity-1' }, { id: 'entity-2' }] })
  })

  it('does not mutate the original data', () => {
    const data = { orgId: ref1 }
    stripEntityRefs(data, { '$.orgId': ref1 })
    expect(data.orgId).toBe(ref1)
  })

  it('returns data unchanged with empty commandIdPaths', () => {
    const data = { a: 1, b: 'two' }
    expect(stripEntityRefs(data, {})).toEqual(data)
  })
})
