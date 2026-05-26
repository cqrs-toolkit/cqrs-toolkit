# 16\. Custom Collations

## 16.1 Purpose

SQLite's built-in collations (`BINARY`, `NOCASE`, `RTRIM`) are not locale-aware, don't handle non-ASCII correctly, and can't express composed orderings like preferred-then-fallback per-locale text.
The client supports custom collations so consumers can register locale-aware comparators (typically wrapping `Intl.Collator`) and reference them by name from any [`CustomColumn.collation`](../../../../../packages/client/src/types/config.ts).

The same comparator drives both the WASM SQLite path (registered via `sqlite3_create_collation_v2`) and the JS-side sort in Mode A, so list ordering is consistent across backends.

Out of scope: per-query `COLLATE` overrides, devtools-side automatic registration, and ICU-bundled SQLite builds.
See [`locale-aware-sort.md`](../../explorations/locale-aware-sort.md) for the open questions remaining beyond this specification.

The load-bearing alternatives considered and rejected are documented in [ADR-0010](../../decisions/0010-custom-collations-design.md).

---

## 16.2 Types

### 16.2.1 CollationConfig

```typescript
interface CollationConfig {
  /** Identifier referenced by CustomColumn.collation. SQL-identifier shape
   *  (letters, digits, underscores, starts with a letter). Case-insensitive. */
  name: string
  /** Total-ordering comparator. Wrap an Intl.Collator for locale-aware sort. */
  compare: (a: string, b: string) => number
}
```

The comparator must define a total order over the strings it sees.

### 16.2.2 Configuration field

```typescript
interface CqrsConfig<...> {
  // existing
  collations?: readonly CollationConfig[]
}
```

The collation set rides on `CqrsConfig` and reaches every entry point that opens the database — main-thread `OnlineOnlyAdapter`, `startDedicatedWorker`, `startSharedWorker`, and the standalone `startSqliteWorker` — by the existing "consumer imports a shared config module" pattern.
Comparator functions are never serialized; they travel by import.

### 16.2.3 CustomColumn.collation widening

```typescript
interface CustomColumn {
  // ...
  collation?: string
}
```

Built-in names (`BINARY`, `NOCASE`, `RTRIM`) are always accepted without registration.
Any other name must appear on `CqrsConfig.collations`.
Names are matched case-insensitively, mirroring SQLite's own behavior.

---

## 16.3 Registration

Per-connection: SQLite does not persist collation names in the database file.
Every connection that opens the DB must register the same set or queries against `COLLATE <name>` columns fail with `no such collation sequence`.

[`loadAndOpenDb`](../../../../../packages/client/src/storage/LocalSqliteDb.ts) accepts `collations` on its config and registers each entry against the opened raw DB via `sqlite3.capi.sqlite3_create_collation_v2`:

```typescript
async function loadAndOpenDb(
  config: LoadAndOpenDbConfig & {
    collations?: readonly CollationConfig[]
  },
): Promise<LocalSqliteDb>
```

The comparator is bridged to SQLite as-is — sqlite-wasm's binding layer auto-wraps JS functions matching the `xCompare` signature.
The library's wrapper reads the operand byte ranges out of the WASM heap via `TextDecoder('utf-8')` and delegates to the consumer-supplied `compare`.
Heap views can be invalidated when the heap grows, so the heap view is re-fetched inside each comparison rather than captured in the closure.

---

## 16.4 Validation

Schema-build-time validator (`validateSchemaMigrations`) accepts a second argument carrying the registered collations.
For each `CustomColumn.collation` reference:

1. Name matches the SQL-identifier shape (`/^[A-Za-z][A-Za-z0-9_]*$/`).
2. Name (case-insensitively) is a built-in or appears in the registered set.

A typo or missing registration fails at construction with a descriptive message — not late at first query.

Built-in names cannot be re-registered: a `CollationConfig` whose name matches a built-in (case-insensitively) is rejected.

---

## 16.5 Mode A parity

In Mode A (`InMemoryStorage`) the SQL backend isn't available — list ordering goes through `sortReadModelRecords` in [`sort-read-models.ts`](../../../../../packages/client/src/storage/sort-read-models.ts).
For locale ordering to agree with the SQL backends, the JS-side sort needs both the value-extraction logic that a generated column would otherwise express in SQL and the comparator that the registered collation supplies.

The sort surface accepts a `SortResolverLookup`:

```typescript
interface SortColumnResolver {
  /** Read the column's value from the record's parsed effectiveData. */
  readValue?: (data: Record<string, unknown>) => unknown
  /** Comparator applied when both sort operands are strings. */
  compareStrings?: (a: string, b: string) => number
}

type SortResolverLookup = (column: string) => SortColumnResolver | undefined
```

`InMemoryStorage` builds the lookup from the schema migrations + registered collations.
For each declared `CustomColumn`:

- `readValue` is built from the column's `path` via `getAtPath` (the `expression` form is not resolvable in JS — those columns return `undefined` from the lookup and fall through to the default `data[column]` access).
- `compareStrings` resolves to the registered comparator when `collation` matches a registered name.

Strings that miss the lookup fall back to the default raw-`<` comparison — matching `BINARY`.

---

## 16.6 Backends without `sqlite3_create_collation_v2`

`better-sqlite3` (used by [`@cqrs-toolkit/client-electron`](../../../client-electron/_overview.md)) does not expose the C-level collation registration through its JS surface, and neither does Node's built-in `node:sqlite` at the time of writing.
A managed column declaring a non-built-in `COLLATE` therefore can't run on those backends without explicit policy.

`SQLiteStorageConfig` carries `unsupportedCollations: 'error' | 'degrade'`:

```typescript
interface SQLiteStorageConfig {
  // ...
  /** Policy for managed columns referencing a non-built-in collation when
   *  the active backend can't register comparators. Built-in names are
   *  unaffected either way. */
  unsupportedCollations?: 'error' | 'degrade'
  /** Human-readable backend label used in the 'error' message. */
  backendLabel?: string
}
```

- **`'error'`** — construction throws with a message naming the column, the collation, and the opt-in path. Recommended default in environments where ordering correctness matters.
- **`'degrade'`** — DDL emission strips `COLLATE <name>` for non-built-in collations. SQL ordering falls back to `BINARY`; locale-aware ordering is lost on the SQL path. Explicit consumer opt-in so a shared `CqrsConfig` can boot across environments.

`startElectronWorker` exposes the policy via `StartElectronWorkerOptions.unsupportedCollations`, defaulting to `'error'`.
WASM-backed paths (`loadAndOpenDb`) leave the field unset — they register the collations directly.

---

## 16.7 Determinism contract

The comparator's behavior is part of the schema contract for the lifetime of any index that mentions its name.
Changing the comparator's options (e.g. toggling `numeric` or `sensitivity` on the underlying `Intl.Collator`) reorders strings without invalidating the index, producing silent corruption.

Consumers must:

- Treat collation behavior as immutable for the database's lifetime.
- When behavior must change, ship a schema migration that `REINDEX`es every index mentioning the affected collation name.

A registry-side fingerprint check that surfaces accidental drift at startup is tracked as deferred work in [`locale-aware-sort.md`](../../explorations/locale-aware-sort.md).

---

## 16.8 Schema example

A two-locale notebook list (English preferred, Russian fallback; and vice versa) with indexed sort:

```typescript
{
  type: 'managed',
  name: 'notebooks',
  columns: [
    {
      name: 'sort_name_en_first',
      type: 'TEXT',
      expression: "coalesce(json_extract(_effective_data,'$.name_en'), json_extract(_effective_data,'$.name_ru'))",
      collation: 'locale_en',
    },
    {
      name: 'sort_name_ru_first',
      type: 'TEXT',
      expression: "coalesce(json_extract(_effective_data,'$.name_ru'), json_extract(_effective_data,'$.name_en'))",
      collation: 'locale_ru',
    },
  ],
  indexes: [
    { columns: ['sort_name_en_first', 'id'] },
    { columns: ['sort_name_ru_first', 'id'] },
  ],
}
```

The library has no notion of "preferred locale" — the consumer's query layer picks which virtual column to sort on based on current UI state:

```typescript
const sortColumn = uiLocale === 'ru' ? 'sort_name_ru_first' : 'sort_name_en_first'
client.queryManager.list({
  collection: 'notebooks',
  cacheKey,
  sort: [{ column: sortColumn, direction: 'asc' }],
})
```

For N supported locales the consumer pays N virtual columns and N composite `(sort_col, id)` indexes for indexed sort with `id` tie-break.
