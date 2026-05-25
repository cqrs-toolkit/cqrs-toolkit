/**
 * Composite sort helpers for {@link ReadModelRecord} arrays.
 *
 * Used by {@link InMemoryStorage.getReadModelsByCollection} — applies sort
 * in JS over the full collection. The SQL-backed storage delegates ordering
 * to SQLite directly.
 *
 * Library-owned columns on the record (`id`, `updated_at`, `_revision`,
 * `_position`, `_has_local_changes`) read directly off the record fields;
 * any other column name resolves via the optional
 * {@link SortResolverLookup} the caller supplies, falling back to a
 * top-level key in the parsed `effectiveData` JSON when the lookup
 * doesn't return an override.
 *
 * For columns whose SQL declaration carries a custom `COLLATE` clause,
 * the lookup's `compareStrings` aligns the JS-side comparator with the SQL
 * backend's collation. Strings that miss the lookup fall back to the
 * default raw-`<` comparison.
 */

import type { ReadModelRecord, StorageSortTerm } from './IStorage.js'

/**
 * Per-column overrides for the JS-side sort path.
 *
 * - `readValue`: how to read the column's value from the record's parsed
 *   `effectiveData`. Use for declared custom columns whose value lives at
 *   a JSONPath that doesn't match the column name (the default fallback
 *   is `data[column]`).
 * - `compareStrings`: total-ordering comparator applied when both sort
 *   operands are strings. Use for columns whose SQL declaration carries a
 *   custom `COLLATE` clause so JS-side ordering matches the SQL backend.
 *
 * Either field may be omitted; the caller composes one resolver per column
 * and returns `undefined` for columns that take the defaults.
 */
export interface SortColumnResolver {
  readValue?: (data: Record<string, unknown>) => unknown
  compareStrings?: (a: string, b: string) => number
}

/**
 * Lookup from sort-term column name to a {@link SortColumnResolver}. The
 * storage composes one of these from the schema's custom columns plus the
 * registered collations. Returning `undefined` for a column (or omitting
 * the lookup entirely) means "use the defaults" — library-owned columns
 * read off the record fields, anything else reads `data[column]`, strings
 * compare via raw `<`.
 */
export type SortResolverLookup = (column: string) => SortColumnResolver | undefined

function readSortValue(
  record: ReadModelRecord,
  column: string,
  resolveColumn?: SortResolverLookup,
): unknown {
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
  let data: Record<string, unknown>
  try {
    data = JSON.parse(record.effectiveData) as Record<string, unknown>
  } catch {
    return undefined
  }
  const override = resolveColumn?.(column)?.readValue
  if (override !== undefined) return override(data)
  return data[column]
}

/**
 * Type-discriminated comparator for sort values. Caller guarantees the
 * inputs are unequal (handled at the caller's tie-skip step), so this
 * returns only `-1` or `1`. Mismatched or unsupported types fall back to
 * string coercion, which keeps the sort stable rather than throwing.
 */
function compareSortValues(
  a: unknown,
  b: unknown,
  stringComparator?: (a: string, b: string) => number,
): -1 | 1 {
  if (typeof a === 'number' && typeof b === 'number') return a < b ? -1 : 1
  if (typeof a === 'string' && typeof b === 'string') {
    if (stringComparator !== undefined) {
      const result = stringComparator(a, b)
      return result < 0 ? -1 : 1
    }
    return a < b ? -1 : 1
  }
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
  resolveColumn?: SortResolverLookup,
): ReadModelRecord[] {
  if (sort.length === 0) return records.slice()
  const copy = records.slice()
  copy.sort((a, b) => {
    for (const term of sort) {
      const aVal = readSortValue(a, term.column, resolveColumn)
      const bVal = readSortValue(b, term.column, resolveColumn)
      if (aVal === bVal) continue
      if (aVal === undefined) return term.direction === 'asc' ? -1 : 1
      if (bVal === undefined) return term.direction === 'asc' ? 1 : -1
      const stringComparator = resolveColumn?.(term.column)?.compareStrings
      const cmp = compareSortValues(aVal, bVal, stringComparator)
      return term.direction === 'asc' ? cmp : -cmp
    }
    return 0
  })
  return copy
}
