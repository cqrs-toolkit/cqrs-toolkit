# ADR 0002 (client) — Per-collection read-model tables, library-generated DDL, typed migration steps

**Status:** Accepted 2026-03-11

## Context

The initial storage design held all read models in a single `read_models` table.
That design did not scale operationally: every collection shared a row layout, schema changes for one collection required a library release that touched the shared table, and there was no per-collection isolation for cache-key associations or for future domain-field indexing.

A second pressure was the migration model.
The single-table layout collapsed _library-controlled_ schema (the columns the library reads/writes) and _consumer-controlled_ schema (the set of collections the consumer's app declares) into one undifferentiated migration list.
Adding a new collection felt like a library schema change to consumers, and the runtime had no structural way to validate that consumers had run the library's required schema.

The longer-horizon ambition — fully consumer-owned DDL with declared promoted columns for indexed domain-field queries — was visible in the design memo but explicitly out of scope for the first cut.
The shipping decision was the per-collection split plus a migration-step typing that creates the seam consumer-owned DDL will eventually slot into, _not_ the consumer-owned DDL itself.

## Decision

### One pair of tables per collection, library-generated

For each declared collection, the library generates a fixed pair of tables:

```sql
CREATE TABLE rm_${name} (
  id TEXT PRIMARY KEY,
  _server_data TEXT,
  _effective_data TEXT NOT NULL,
  _has_local_changes INTEGER NOT NULL DEFAULT 0,
  _revision TEXT,
  _position TEXT,
  updated_at INTEGER NOT NULL,
  __client_id TEXT,
  __reconciled_at INTEGER
);

CREATE TABLE rm_${name}_cache_keys (
  entity_id TEXT NOT NULL,
  cache_key TEXT NOT NULL,
  PRIMARY KEY (entity_id, cache_key)
);
CREATE INDEX idx_rm_${name}_cks_cache_key ON rm_${name}_cache_keys (cache_key);
```

The column set is fixed and library-owned.
Domain data lives in `_effective_data` as a JSON blob; `_server_data` holds the baseline JSON when local changes are pending (NULL otherwise).
Consumers do not declare columns, indexes, or constraints on these tables.

### Column-naming convention

- **Non-prefixed** (`id`, `updated_at`): public columns — part of the read-model API surface.
- **Single underscore prefix** (`_server_data`, `_effective_data`, `_has_local_changes`, `_revision`, `_position`): library-private state for optimistic-update / sync-position bookkeeping.
- **Double underscore prefix** (`__client_id`, `__reconciled_at`): library-private metadata.

Column names cannot collide with this convention because consumers do not write column names today.
The convention exists as a forward contract for the future `type: 'custom'` collections (see "Future work" below) — at that point, `_` and `__` prefixes will be reserved for the library and rejected from consumer DDL.

### Cache-key associations live in a junction table, not as a column

`rm_${name}_cache_keys` is a many-to-many join between entity ids and cache keys.
Each entity can be associated with multiple cache keys (and vice versa); evicting a cache key drops the join rows for that key without touching the entity rows or other associations.
The index on `cache_key` makes lookup-by-cache-key a primary-key-driven query.

This shape replaces a `_cacheKey` column the original memo proposed.
The normalization was the right call once the multi-cache-key reality became visible — a single column would have forced one association per entity.

### Typed migration steps: `library` and `managed` (and future `custom`)

`SchemaMigration` is `{ version: number; message: string; steps: MigrationStep[] }`.
Versions are sequential starting from 1; the library asserts this on validation.

Two `MigrationStep` types ship today:

- **`type: 'library'`** — `{ id, version, sql: string[] }`.
  Carries raw SQL strings the library wants run on the consumer's database.
  The library exposes its required schema as a set of pre-defined library steps via `clientSchema.<stepId>`; consumers compose these into their migration sequence.
  The library validates that every `REQUIRED_LIBRARY_STEPS` id is present somewhere in the consumer's migrations and that library-step versions appear in strictly ascending order.
- **`type: 'managed'`** — `{ name }`.
  Declares a collection.
  The library calls `generateCollectionDDL(name)` and runs the resulting DDL.
  Consumers do not see or write the per-collection DDL.

A third type, `type: 'custom'`, is **future work**.
It will hold consumer-owned DDL for collections that need consumer-declared columns, indexes, or constraints (the original memo's full design).
Today it is referenced only in a forward-looking JSDoc comment in the schema module — no implementation exists.

### Validation rules

`validateSchemaMigrations` enforces (asserting on violation):

1. Sequential versions starting from 1.
2. Collection names match `^[a-z][a-z0-9_]*$` and are ≤ 50 characters.
3. No duplicate collection names across all migrations in the sequence.
4. All `REQUIRED_LIBRARY_STEPS` ids are present.
5. Library step versions strictly ascend.

The validation runs at config resolution; a malformed migration fails fast, not at first DDL execution.

### Read API stays JSON-backed

`list<T>('todos')` returns the rows decoded from `_effective_data`.
There is no SQL-level filtering by domain fields; that is part of the future-work piece below.

## Consequences

### Implementation impact

- New schema generator `generateCollectionDDL(name)` producing the fixed `rm_${name}` + `rm_${name}_cache_keys` table pair per collection.
- New `SchemaMigration` validation: sequential versions, collection-name regex (`^[a-z][a-z0-9_]*$`, ≤ 50 chars), no duplicate collection names across migrations, `REQUIRED_LIBRARY_STEPS` presence, strictly ascending library-step versions.
- New typed migration-step union: `MigrationStep` = `'library' | 'managed'` today, `'custom'` reserved as a forward contract.
- Junction-table read paths for cache-key lookup; bulk delete on cache-key eviction.
- Column-naming convention (`_` and `__` prefixes) reserved for library use, enforceable when `type: 'custom'` lands.

### Operational implications

#### Gains

- Per-collection tables isolate row growth, eviction patterns, and DDL evolution.
  A collection can be dropped or recreated without touching others.
- The junction table for cache-key associations supports many-to-many naturally, evicting a key drops the join rows without entity-row work, and the cache-key index makes lookup-by-key cheap.

#### Costs

- Domain-field queries still load the JSON blob and filter in JS.
  At small scale this is fine; at large scale it is the bottleneck the future `type: 'custom'` + promoted columns work will resolve.
- The `_effective_data` JSON blob means write workloads pay JSON serialization on every row update, even for trivially small mutations.

### Coding implications

#### Gains

- The migration system distinguishes library-controlled SQL from consumer-declared collections cleanly.
  A consumer adding a new collection writes one `{ type: 'managed', name }` line; the library handles DDL, generation, and the junction table.
- The `_` and `__` prefix conventions create the seam for `type: 'custom'` consumer DDL — the contract for future work is documented, not invented later.

#### Costs

- Adding a column to the library schema requires a new library step that ALTERs every existing managed collection table.
  The plumbing for this is anticipated in the schema module's "Future" comment ("when `LibraryStep` gains `collectionHook`, this function will also need the set of known managed tables to apply ALTER TABLE operations") — no current step exercises it.
- Consumers cannot declare collection-specific indexes, constraints, or composite keys today.
  The escape hatch is `type: 'library'` raw SQL — but that is conceptually wrong for collection-shape data, and using it that way will conflict with the eventual `type: 'custom'` migration to consumer-owned DDL.

## Future work

The original 2026-03-08 design memo proposed:

- Consumer-owned DDL via a `type: 'custom'` migration step.
- Promoted columns: consumer declares queryable fields; library generates real indexed columns alongside the JSON blob; query API accepts filter params that become WHERE clauses.
- A `createTable(name, columns)` helper returning a SQL string for trivial cases.
- Consumer-written raw SQL for cross-scope or aggregated reads.

These are explicitly _future work_, not part of this ADR.
Indexed domain-field queries — the parent-child filtering case, where a consumer holds many entities under one cache key (e.g. all notes loaded together) but wants to render only a subset filtered by a domain field (e.g. notes belonging to one notebook) without pulling every row into JS — and consumer-controlled read-model schemas converge on this same future direction.

A future ADR will lock in the design when the work is scheduled.
This ADR's contribution to that future is the table-per-collection layout, the column-prefix convention, and the migration-step typing — all of which the future change extends rather than reworks.

## Notes

The "deferred" framing in the original memo (2026-03-08) was reluctance to commit to a multi-table layout before consumer pressure justified it.
Three days later the per-collection split shipped — but only the split.
The full memo (consumer-owned DDL, list-with-filter API expanded to SQL filtering, promoted columns) did not ship and remains future work.

Future readers should treat this ADR as the live design; the memo is captured here insofar as the column conventions and per-collection layout it proposed are the ones that landed.
