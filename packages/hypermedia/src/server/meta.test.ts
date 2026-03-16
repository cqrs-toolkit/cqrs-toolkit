import { describe, expect, it } from 'vitest'
import type { HypermediaTypes } from '../types.js'
import {
  addCountsToResourceDescriptor,
  buildIncludeSchema,
  getRequestedCollectionMeta,
} from './meta.js'

describe('buildIncludeSchema', () => {
  it('builds schema with enum from list', () => {
    const schema = buildIncludeSchema(['total', 'counts'])
    expect(schema).toEqual({
      type: 'string',
      enum: ['total', 'counts'],
      errorMessage: {
        enum: 'Allowed values are: [total, counts].',
      },
    })
  })

  it('builds schema from empty list', () => {
    const schema = buildIncludeSchema([])
    expect(schema).toEqual({
      type: 'string',
      enum: [],
      errorMessage: { enum: 'Allowed values are: [].' },
    })
  })
})

describe('getRequestedCollectionMeta', () => {
  it('returns all false for undefined query', () => {
    expect(getRequestedCollectionMeta(undefined)).toEqual({ total: false, counts: false })
  })

  it('returns all false for empty query', () => {
    expect(getRequestedCollectionMeta({})).toEqual({ total: false, counts: false })
  })

  it('detects total from string include', () => {
    expect(getRequestedCollectionMeta({ include: 'total' })).toEqual({
      total: true,
      counts: false,
    })
  })

  it('detects counts from string include', () => {
    expect(getRequestedCollectionMeta({ include: 'counts' })).toEqual({
      total: false,
      counts: true,
    })
  })

  it('detects both from array include', () => {
    expect(getRequestedCollectionMeta({ include: ['total', 'counts'] })).toEqual({
      total: true,
      counts: true,
    })
  })

  it('ignores unknown include values', () => {
    expect(getRequestedCollectionMeta({ include: 'unknown' })).toEqual({
      total: false,
      counts: false,
    })
  })

  it('handles array with only unknown values', () => {
    expect(getRequestedCollectionMeta({ include: ['unknown'] })).toEqual({
      total: false,
      counts: false,
    })
  })
})

describe('addCountsToResourceDescriptor', () => {
  it('attaches _counts from itemMap match', () => {
    const rd: HypermediaTypes.ResourceDescriptor = {
      class: 'test:Item',
      properties: { id: 'k1' },
    }
    const countDesc: HypermediaTypes.ResourceDescriptor = {
      class: 'test:Counts',
      properties: { active: 5, archived: 2 },
    }
    const itemMap = new Map<string, HypermediaTypes.ResourceDescriptor | undefined>([
      ['k1', countDesc],
    ])
    addCountsToResourceDescriptor('k1', rd, itemMap)
    expect(rd.properties._counts).toEqual({ active: 5, archived: 2 })
  })

  it('does nothing when itemMap is null', () => {
    const rd: HypermediaTypes.ResourceDescriptor = {
      class: 'test:Item',
      properties: { id: 'k1' },
    }
    addCountsToResourceDescriptor('k1', rd, null)
    expect(rd.properties._counts).toBeUndefined()
  })

  it('does nothing when itemMap is undefined', () => {
    const rd: HypermediaTypes.ResourceDescriptor = {
      class: 'test:Item',
      properties: { id: 'k1' },
    }
    addCountsToResourceDescriptor('k1', rd, undefined)
    expect(rd.properties._counts).toBeUndefined()
  })

  it('does nothing when key is not in itemMap', () => {
    const rd: HypermediaTypes.ResourceDescriptor = {
      class: 'test:Item',
      properties: { id: 'k1' },
    }
    const itemMap = new Map<string, HypermediaTypes.ResourceDescriptor | undefined>()
    addCountsToResourceDescriptor('k1', rd, itemMap)
    expect(rd.properties._counts).toBeUndefined()
  })
})
