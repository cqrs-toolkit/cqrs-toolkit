import { describe, expect, it } from 'vitest'
import type { ReadModelRecord, StorageSortTerm } from './IStorage.js'
import { sortReadModelRecords } from './sort-read-models.js'

function rec(overrides: Partial<ReadModelRecord> & { id: string }): ReadModelRecord {
  return {
    id: overrides.id,
    collection: overrides.collection ?? 'todos',
    cacheKeys: overrides.cacheKeys ?? [],
    serverData: overrides.serverData ?? null,
    effectiveData: overrides.effectiveData ?? '{}',
    hasLocalChanges: overrides.hasLocalChanges ?? false,
    updatedAt: overrides.updatedAt ?? 0,
    revision: overrides.revision ?? null,
    position: overrides.position ?? null,
    _clientMetadata: overrides._clientMetadata ?? null,
  }
}

describe('sortReadModelRecords', () => {
  it('returns a copy when sort is empty', () => {
    const input = [rec({ id: 'b' }), rec({ id: 'a' })]
    const result = sortReadModelRecords(input, [])
    expect(result).not.toBe(input)
    expect(result.map((r) => r.id)).toEqual(['b', 'a'])
  })

  it('sorts by id ascending', () => {
    const input = [rec({ id: 'c' }), rec({ id: 'a' }), rec({ id: 'b' })]
    const result = sortReadModelRecords(input, [{ column: 'id', direction: 'asc' }])
    expect(result.map((r) => r.id)).toEqual(['a', 'b', 'c'])
  })

  it('sorts by id descending', () => {
    const input = [rec({ id: 'a' }), rec({ id: 'c' }), rec({ id: 'b' })]
    const result = sortReadModelRecords(input, [{ column: 'id', direction: 'desc' }])
    expect(result.map((r) => r.id)).toEqual(['c', 'b', 'a'])
  })

  it('sorts by updated_at then id (composite)', () => {
    const input = [
      rec({ id: 'b', updatedAt: 100 }),
      rec({ id: 'a', updatedAt: 100 }),
      rec({ id: 'c', updatedAt: 50 }),
    ]
    const sort: StorageSortTerm[] = [
      { column: 'updated_at', direction: 'desc' },
      { column: 'id', direction: 'asc' },
    ]
    const result = sortReadModelRecords(input, sort)
    expect(result.map((r) => r.id)).toEqual(['a', 'b', 'c'])
  })

  it('falls back to effectiveData JSON for unknown columns', () => {
    const input = [
      rec({ id: 'r1', effectiveData: JSON.stringify({ priority: 3 }) }),
      rec({ id: 'r2', effectiveData: JSON.stringify({ priority: 1 }) }),
      rec({ id: 'r3', effectiveData: JSON.stringify({ priority: 2 }) }),
    ]
    const result = sortReadModelRecords(input, [{ column: 'priority', direction: 'asc' }])
    expect(result.map((r) => r.id)).toEqual(['r2', 'r3', 'r1'])
  })

  it('places undefined values first when ascending, last when descending', () => {
    const input = [
      rec({ id: 'present', effectiveData: JSON.stringify({ priority: 5 }) }),
      rec({ id: 'missing', effectiveData: '{}' }),
    ]
    const asc = sortReadModelRecords(input, [{ column: 'priority', direction: 'asc' }])
    expect(asc.map((r) => r.id)).toEqual(['missing', 'present'])
    const desc = sortReadModelRecords(input, [{ column: 'priority', direction: 'desc' }])
    expect(desc.map((r) => r.id)).toEqual(['present', 'missing'])
  })

  it('tolerates malformed effectiveData JSON', () => {
    const input = [
      rec({ id: 'good', effectiveData: JSON.stringify({ x: 1 }) }),
      rec({ id: 'bad', effectiveData: 'not json' }),
    ]
    expect(() => sortReadModelRecords(input, [{ column: 'x', direction: 'asc' }])).not.toThrow()
  })

  it('does not mutate the input array', () => {
    const input = [rec({ id: 'c' }), rec({ id: 'a' }), rec({ id: 'b' })]
    const snapshot = input.map((r) => r.id)
    sortReadModelRecords(input, [{ column: 'id', direction: 'asc' }])
    expect(input.map((r) => r.id)).toEqual(snapshot)
  })
})
