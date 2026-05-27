# View array joins

## Context

Cross-collection views ([`cross-collection-joins.md`](cross-collection-joins.md)) and the missing-join gate ([`cross-collection-joins.md`'s third trigger](cross-collection-joins.md#live-invalidation--three-independent-re-fetch-triggers)) cover joins where each primary row references at most **one** target by id. Real applications also have n-to-1 relationships where the foreign key is an **array** of ids on the primary row (e.g., `tagIds: string[]` for tags on a project). Two open gaps:

1. **Storage / SQL.** A SQL view can't index into a JSON array efficiently. The naive workaround (`json_each` over each row's array) scales to thousands of rows but starts to bite at the 1e4–5 row target.
2. **Gate machinery.** The proxy / worker `watchView` extraction (`referencedIdPath` / `referencingIdPath` → `referencedIds` / `referencingIds`) assumes one id per row. Array joins need each row to contribute _multiple_ ids to the tracking sets.

## Observations

- The two gaps are independent. `json_each` resolves the storage gap without library help; the gate gap is the same regardless of whether the SQL uses `json_each` or a junction table.
- Array elements may be plain strings or `EntityRef` objects (the library's id-with-temp-mapping type). Junction-table storage needs both forms — the resolved string id for joining, and the original JSON form for the consumer's transform to reconstruct EntityRefs on hydration.
- Junction-table sync runs inside the read-model commit batch; the diff is on the extracted-id set, not the raw array — changes to other fields on array-of-object elements don't trigger junction writes.

## Scope

**In:**

- Multi-value gate extraction so existing `referencedIdPath` / `referencingIdPath` declarations work against array-shaped paths (`$.tagIds[*]`, `$.tags[*].id`).
- Library-managed junction table primitive for SQL-backed deployments at scale — a new migration step plus commit-time sync.
- Documentation of the `json_each` fallback for small-data tables that don't justify a junction.

**Out:**

- Predicate-shaped dependencies (see [`view-predicate-dependencies.md`](view-predicate-dependencies.md)) — orthogonal axis.
- Array joins where the relationship is many-to-many on _both_ sides modelled symmetrically. The current shape is one parent's array → many target rows; reverse traversal goes through the same junction with the reverse index.

## Small-data path: `json_each`

For tables expected to stay below ~1e3 rows, a SQL view can join through an array directly with SQLite's `json_each`:

```sql
SELECT p.id, p._effective_data AS project, t._effective_data AS tag
FROM rm_projects p
JOIN json_each(p._effective_data, '$.tagIds') jt
JOIN rm_tags t ON t.id = jt.value
WHERE p.workspace_id = ?
```

No library changes needed. The cost is a per-row array scan; no index on array elements. Acceptable for small tables, untenable at the 1e4–5 target.

The gate-extraction extension below is required regardless of which storage approach the view picks — the view's `referencedIdPath` / `referencingIdPath` declarations need to surface multi-value paths into the tracking sets.

## Gate multi-value extraction

Today the proxy / worker `watchView` extracts a single id per row via `getAtPath(row, joinSpec.referencedIdPath)`. For array-shaped paths (`$.tagIds[*]` or `$.tags[*].id`), the extractor needs to return every matched leaf value rather than the first.

The library already has wildcard-aware path walking via `findMatchingPaths` (used by the EntityRef resolver). The watchView extraction switches to a multi-value form for paths that contain `[*]`; for paths without wildcards it stays single-value (no behaviour change for existing views). Every yielded id joins the per-collection tracking set normally.

Declaration shape stays the same — same field names, same gate logic:

```ts
joinSources: [
  {
    collection: TAGS_COLLECTION_NAME,
    referencedIdPath: '$._embedded["pms.Tag"][*].id', // multi-value
    referencingIdPath: '$.tagIds[*]', // multi-value
  },
]
```

## Junction table primitive (large-data path)

### Declaration

A junction is a standalone migration step. Not co-located with the parent's `ManagedCollectionDef` — one declaration shape regardless of when the junction lands relative to the parent.

```ts
interface JunctionStep {
  type: 'junction'
  parent: string // collection whose writes trigger sync; must be a managed collection declared in this or an earlier migration
  name: string // full table identifier; library creates `rm_<name>`
  path: JSONPathExpression // path on _effective_data to the array; final value at each match must be an EntityId
}

type MigrationStep = LibraryStep | ManagedCollectionDef | JunctionStep
```

`name` is user-owned (uniqueness is the consumer's responsibility, same contract as `ManagedCollectionDef.name`). v1 can declare the parent; v2 (or v1 alongside) can declare the junction.

### DDL

Public contract — the consumer's view SQL references the table directly:

```sql
CREATE TABLE rm_<name> (
  parent_id   TEXT NOT NULL,
  child_id    TEXT NOT NULL,           -- entityIdToString(element)
  child_value TEXT,                    -- JSON.stringify(element) when EntityRef; NULL when plain-string id
  PRIMARY KEY (parent_id, child_id)
) STRICT, WITHOUT ROWID;

CREATE INDEX idx_rm_<name>_child ON rm_<name>(child_id);
```

The reverse index is always emitted — the library decides, the consumer doesn't opt in/out.

`child_value` is conditionally populated:

- Plain-string id (`"abc-123"`) → `child_id = "abc-123"`, `child_value = NULL`.
- EntityRef object → `child_id = entityIdToString(ref)`, `child_value = JSON.stringify(ref)`.

The consumer's transform branches on `child_value IS NULL` rather than parsing + checking type, which is strictly worse.

### Commit-time sync

Piggybacks on the read-model commit batch. For each row touched (created / updated / deleted) on a collection with junctions:

1. Walk the declared path against the **new** effective_data, extracting the set of `(child_id, child_value)` pairs. Use the library's wildcard-aware path walker so `$.tagIds[*]` and `$.tags[*].id` both work.
2. Walk the same path against the **old** effective_data (NULL for creates, current row for updates, NULL for deletes).
3. Diff on the **extracted-id set** — changes to non-id fields on array-of-object elements don't trigger junction writes.
4. `INSERT` added pairs; `DELETE FROM rm_<name> WHERE parent_id = ? AND child_id IN (...)` removed pairs.
5. For deletes: `DELETE FROM rm_<name> WHERE parent_id = ?`.

All writes happen in the same transaction as the read-model commit — no separate transaction, no eventual consistency.

### Mode A (in-memory)

Junctions don't exist. The in-memory dispatcher's `memory` callback iterates the array directly — same code the consumer would write without junctions.

## Open questions

- **EntityRef inside array-of-object paths.** For a path like `$.tags[*].id`, the resolved value is the `id` field on each `tags[]` element. If that `id` is an `EntityRef`, the junction stores its JSON form in `child_value`. But the consumer's transform would typically want the full `tags[]` element, not just the id — the rest of the element (label, color, etc.) isn't preserved by the junction. The consumer rehydrates from `rm_tags` via `child_id` for the canonical tag data, then layers any per-relationship metadata from the parent's `_effective_data.tags[]` themselves. Worth confirming this is the intended hydration pattern before locking the docs.
- **Index reuse across views.** Multiple views on different parent collections that join to the same target via different junctions will each have their own `child_id` reverse index. SQLite's query planner can use any of them for queries against the target — but if the application has a hot reverse-lookup path (e.g., "all parents that reference this tag"), the junction's own reverse index covers it directly; no second declaration needed.
- **Junction sync ordering vs. cache-key writes.** The existing commit pipeline writes `_clientMetadata` (including cacheKey membership) inline with the row. Junction inserts happen in the same batch; the ordering between row-write and junction-sync within a batch is implementation detail and not part of the public contract. Worth a test that confirms junction rows are visible to readers after the commit completes.
- **Dropping a junction.** Not in V1. A future `{ type: 'junction-drop', name }` step could remove one in a later migration; deferred until a real use case lands.

## Alternatives considered

- **Inline `junctionTables?: JunctionTable[]` on `ManagedCollectionDef`.** Considered for co-locating the junction with its parent's creation step. Rejected: junctions need to be addable in later migrations (v1 creates parent, v2 adds junction), and supporting both inline and standalone forms doubles the declaration shape for no semantic gain. Standalone-only is uniform.
- **`extractId?: (item) => string` callback on the junction.** Rejected: the JSONPath itself does the extraction (`$.tags[*].id` navigates into objects naturally; `$.tagIds[*]` reads strings). Adding a callback for what the path already expresses is duplicate machinery.
- **`reverseIndex?: boolean` opt-out.** Rejected: the reverse-lookup index is always useful when joining through the junction backwards, has bounded cost, and forcing the consumer to opt in is needless friction.
- **`rm_<parent>_<name>` table-name construction.** Rejected: too much library magic; harder to grep for `rm_<table_name>` when the prefix is composed; obscures finding the migration step that declared a given table. User-supplied full `name` keeps the lookup direct.
- **Always-populated `child_value` (JSON-quoted strings too).** Rejected: pushes a branch into every consumer transform (`JSON.parse(child_value)` always), more storage per row. Nullable `child_value` with `IS NULL` branch on the consumer side is strictly simpler.

## Status

Active — V1 implementation landing 2026-05-26.

**Plan:**

1. Multi-value gate extraction in `watchView` (proxy + worker engines).
2. `JunctionStep` migration type + DDL emission + central validation.
3. Commit-time junction sync.
4. Tests + integration covering a junction-backed view end-to-end.
