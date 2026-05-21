/**
 * Composite sort helpers for {@link ReadModelRecord} arrays.
 *
 * Used by:
 * - {@link InMemoryStorage.getReadModelsByCollection} — applies sort in JS
 *   over the full collection.
 * - {@link ReadModelStore.list}'s cacheKey-scoped path — sorts records returned
 *   by `getReadModelsByCacheKey`, which has no `options` parameter.
 *
 * V1 scope: library-owned columns on the record (`id`, `updated_at`,
 * `_revision`, `_position`, `_has_local_changes`) read directly off the
 * record fields; any other column name falls back to a top-level key in the
 * parsed `effectiveData` JSON. The fallback is best-effort — proper
 * column ↔ path resolution for custom columns lands alongside `watchList`.
 */

import type { ReadModelRecord, StorageSortTerm } from './IStorage.js'

function readSortValue(record: ReadModelRecord, column: string): unknown {
  switch (column) {
    case 'id':
      return record.id
    case 'updated_at':
      return record.updatedAt
    case '_revision':
      return record.revision
    case '_position':
      return record.position
    case '_has_local_changes':
      return record.hasLocalChanges
  }
  try {
    const data = JSON.parse(record.effectiveData) as Record<string, unknown>
    return data[column]
  } catch {
    return undefined
  }
}

/**
 * Type-discriminated comparator for sort values. Caller guarantees the
 * inputs are unequal (handled at the caller's tie-skip step), so this
 * returns only `-1` or `1`. Mismatched or unsupported types fall back to
 * string coercion, which keeps the sort stable rather than throwing.
 */
function compareSortValues(a: unknown, b: unknown): -1 | 1 {
  if (typeof a === 'number' && typeof b === 'number') return a < b ? -1 : 1
  if (typeof a === 'string' && typeof b === 'string') return a < b ? -1 : 1
  if (typeof a === 'bigint' && typeof b === 'bigint') return a < b ? -1 : 1
  if (typeof a === 'boolean' && typeof b === 'boolean') return a ? 1 : -1
  return String(a) < String(b) ? -1 : 1
}

/**
 * Composite sort — earlier terms dominate, later terms break ties.
 * `undefined` values sort to one end (ascending: first; descending: last).
 *
 * Returns a new array; does not mutate the input.
 */
export function sortReadModelRecords(
  records: readonly ReadModelRecord[],
  sort: readonly StorageSortTerm[],
): ReadModelRecord[] {
  if (sort.length === 0) return records.slice()
  const copy = records.slice()
  copy.sort((a, b) => {
    for (const term of sort) {
      const aVal = readSortValue(a, term.column)
      const bVal = readSortValue(b, term.column)
      if (aVal === bVal) continue
      if (aVal === undefined) return term.direction === 'asc' ? -1 : 1
      if (bVal === undefined) return term.direction === 'asc' ? 1 : -1
      const cmp = compareSortValues(aVal, bVal)
      return term.direction === 'asc' ? cmp : -cmp
    }
    return 0
  })
  return copy
}
