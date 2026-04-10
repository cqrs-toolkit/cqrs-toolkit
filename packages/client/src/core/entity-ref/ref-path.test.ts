import { describe, expect, it } from 'vitest'
import { createEntityRef, isEntityRef } from '../../types/entities.js'
import {
  extractTopLevelEntityRefs,
  findMatchingPaths,
  getAtPath,
  resolveRefPaths,
  setAtPath,
  stripEntityRefs,
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
    const entityRefData = { '$.notebookId': ref1 }
    const result = stripEntityRefs(data, entityRefData)
    expect(result).toEqual({ notebookId: 'entity-1', title: 'hello' })
  })

  it('handles multiple replacements', () => {
    const data = { orgId: ref1, deptId: ref2, name: 'test' }
    const entityRefData = { '$.orgId': ref1, '$.deptId': ref2 }
    const result = stripEntityRefs(data, entityRefData)
    expect(result).toEqual({ orgId: 'entity-1', deptId: 'entity-2', name: 'test' })
  })

  it('handles nested paths', () => {
    const data = { metadata: { orgId: ref1 } }
    const entityRefData = { '$.metadata.orgId': ref1 }
    const result = stripEntityRefs(data, entityRefData)
    expect(result).toEqual({ metadata: { orgId: 'entity-1' } })
  })

  it('handles array paths', () => {
    const data = { forms: [{ id: ref1 }, { id: ref2 }] }
    const entityRefData = { '$.forms[0].id': ref1, '$.forms[1].id': ref2 }
    const result = stripEntityRefs(data, entityRefData)
    expect(result).toEqual({ forms: [{ id: 'entity-1' }, { id: 'entity-2' }] })
  })

  it('does not mutate the original data', () => {
    const data = { orgId: ref1 }
    stripEntityRefs(data, { '$.orgId': ref1 })
    expect(data.orgId).toBe(ref1)
  })

  it('returns data unchanged with empty entityRefData', () => {
    const data = { a: 1, b: 'two' }
    expect(stripEntityRefs(data, {})).toEqual(data)
  })
})
