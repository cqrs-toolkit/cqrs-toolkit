# 12. Client-Side Aggregations

## 12.1 Purpose

Client-Side Aggregations provide **locally-computed derived values** (counts, sums, groupings) from collections in the Read Model Store.

They enable:

- counts, sums, and other reductions scoped to a cache key

- offline-capable aggregation without server round-trips

- real-time updates as underlying data changes

Aggregations reflect the current effective state of cached data.

---

## 12.2 Primary approach: Live SQL queries

The Read Model Store uses SQLite (WASM).
For most aggregation needs, **live SQL queries** are the recommended approach.

```sql
SELECT
  taskId,
  COUNT(*) as total,
  SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved
FROM requirements
WHERE projectId = ? AND deletedAt IS NULL
GROUP BY taskId
```

Advantages:

- Always accurate (no drift possible)

- No additional storage required

- No incremental update logic to maintain

- Leverages SQLite's optimized query engine

- Simple to define and modify

### 12.2.1 Definition model (live queries)

```ts
{
  aggregationId: string;
  query: string;                        // SQL query with placeholders
  params: (cacheKey: string) => any[];  // Parameter binding
}
```

Example:

```ts
{
  aggregationId: 'requirement-counts-by-task',
  query: `
    SELECT
      taskId,
      COUNT(*) as total,
      SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved
    FROM requirements
    WHERE projectId = ? AND deletedAt IS NULL
    GROUP BY taskId
  `,
  params: (cacheKey) => [cacheKey]
}
```

### 12.2.2 Query Manager integration (live queries)

```ts
queryAggregation<A>({
  aggregationId: string;
  cacheKey: string;
}) -> Promise<A>
```

- Executes the SQL query on demand

- Returns the computed result

- Consumers subscribe to `ReadModelUpdated` events as invalidation signals and re-query when needed

### 12.2.3 Performance considerations

Live queries are suitable when:

- Collection sizes are bounded (typical for offline-cached data)

- Query frequency is moderate (not every frame)

- Proper indexes exist on filter and group columns

For an offline client with bounded data per cache key, SQLite query performance is generally sufficient.

---

## 12.3 Fallback approach: Pre-computed aggregations

When profiling reveals that live queries cause unacceptable latency, pre-computed aggregations with incremental updates may be used.

**Use this approach only when:**

- Live query latency measurably impacts user experience

- Queries run at high frequency (e.g., during scroll, animation)

- Collection sizes are large relative to query complexity

**Do not use this approach preemptively.** Profile first.

---

## 12.4 Pre-computed aggregation definition model

Each pre-computed aggregation is defined by:

- `aggregationId: string`
  Unique identifier for this aggregation type.

- `collectionName: string`
  The Read Model Store collection to aggregate.

- `project: (record: T) => Array<{ cacheKey: string; id: string; data: D }>`
  Projects a record to zero or more contributions.
  Each contribution specifies:
  - `cacheKey` — which cache key's aggregation this contributes to
  - `id` — the entity ID (for per-entity projection tracking)
  - `data` — the projection value

  Returning an empty array filters the record out entirely.
  Contributions for cache keys not currently tracked are discarded.

- `combine: (current: A, delta: D) => A`
  Applies a delta to the current aggregation value.

- `invert: (delta: D) => D`
  Produces the inverse of a delta for removal operations.

- `zero: A`
  The initial aggregation value (identity element).

Example:

```ts
{
  aggregationId: 'requirement-counts-by-task',
  collectionName: 'requirements',

  project: (req) => req.deletedAt ? [] : [{
    cacheKey: req.projectId,
    id: req.id,
    data: { [req.taskId]: { total: 1, approved: req.status === 'approved' ? 1 : 0 } }
  }],

  combine: (current, delta) => mergeAdditive(current, delta),

  invert: (delta) => negateDelta(delta),

  zero: {}
}
```

---

## 12.5 Delta semantics (pre-computed)

Deltas represent changes to an aggregation value.

For count-based aggregations, deltas are **signed integers**:

- `+1` — entity added or now matches filter

- `-1` — entity removed or no longer matches filter

- `0` — no change to this dimension

Multi-dimensional aggregations use objects with signed integer values:

```ts
{ total: +1, approved: +1 }   // approved entity added
{ total: 0, approved: -1 }    // entity changed from approved to not
{ total: -1, approved: 0 }    // non-approved entity removed
```

Future aggregation types (sets, max, etc.) may define alternative delta shapes as needed.

---

## 12.6 Per-entity projection tracking (pre-computed)

To compute deltas on record changes, the aggregation system maintains a **projection cache**:

- keyed by `(aggregationId, cacheKey, entityId)`

- stores the **current projection** for each entity

- stores `null` if the entity is filtered out

When a record changes:

1. Look up the previous projection (may be `null`)

2. Compute the new projection from the updated record (may be `null`)

3. If projections differ, compute and apply delta

4. Store the new projection

This enables accurate incremental updates without scanning the full collection.

---

## 12.7 Incremental update flow (pre-computed)

When the Read Model Store emits a record change (via Event Processor):

1. For each pre-computed aggregation defined on that collection:

- Retrieve the previous projection for the entity

- Compute the new projection (or `null` if filtered out / deleted)

2. If previous projection equals new projection:

- No update required

3. If projections differ:

- Compute removal delta: `invert(previousProjection)` (if previous was not `null`)

- Compute addition delta: `newProjection` (if new is not `null`)

- Apply deltas to current aggregation value via `combine`

- Persist updated aggregation value and new projection atomically

4. Emit `AggregationUpdated` event if value changed

---

## 12.8 Initialization (pre-computed)

When a cache key is seeded for a collection with pre-computed aggregations:

1. Initialize aggregation value to `zero`

2. For each record in the seeded collection:

- Compute projection

- If non-empty, apply via `combine`

- Store projection in cache

3. Persist aggregation value

4. Emit `AggregationUpdated`

Initialization occurs as part of the `CollectionSeedCompleted` lifecycle.

---

## 12.9 Full recompute (pre-computed)

A full recompute reconstructs the aggregation from scratch by scanning the collection.

**Candidate triggers** (final set TBD during implementation):

- Collection seed or reseed

- Stateful refetch completion for the collection

- Application version change (projection logic may have changed)

- Validation failure (e.g., negative count detected)

- Explicit request (debug/administrative)

Full recompute:

1. Read all records for `(collectionName, cacheKey)` from Read Model Store

2. Project each record

3. Combine all projections into new aggregation value

4. Replace stored aggregation value and rebuild projection cache

5. Emit `AggregationUpdated` if value changed

---

## 12.10 Storage schema (pre-computed)

### Aggregation values

Table: `aggregation_values`

```sql
CREATE TABLE aggregation_values (
  key TEXT PRIMARY KEY,           -- '${aggregationId}:${cacheKey}'
  aggregation_id TEXT NOT NULL,
  cache_key TEXT NOT NULL,
  value TEXT NOT NULL,            -- JSON-encoded aggregation value
  computed_at INTEGER NOT NULL,   -- timestamp of last full compute
  update_count INTEGER NOT NULL   -- incremental updates since last full compute
);
```

### Per-entity projections

Table: `aggregation_projections`

```sql
CREATE TABLE aggregation_projections (
  key TEXT PRIMARY KEY,           -- '${aggregationId}:${cacheKey}:${entityId}'
  aggregation_id TEXT NOT NULL,
  cache_key TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  projection TEXT                 -- JSON-encoded projection, NULL if filtered out
);

CREATE INDEX idx_agg_proj_cache_key ON aggregation_projections(cache_key);
```

Both tables are updated atomically within a single transaction when processing record changes.

---

## 12.11 Interaction with cache eviction

On `CacheKeyEvicted(key)`:

- For live queries: no action required (query will return empty results)

- For pre-computed aggregations:
  - Delete all aggregation values where `cache_key = key`

  - Delete all projection cache entries where `cache_key = key`

Eviction is handled identically to Read Model Store eviction.

---

## 12.12 Session reset handling

On session reset (user identity change):

- All aggregation values are deleted

- All projection cache entries are deleted

- No aggregation data from the previous session may survive

This is part of the unconditional full data wipe defined in §10.10.

---

## 12.13 Query Manager integration (pre-computed)

For pre-computed aggregations, the Query Manager exposes:

```ts
getAggregation<A>({
  aggregationId: string;
  cacheKey: string;
}) -> Promise<A | null>
```

Returns:

- The current pre-computed aggregation value

- `null` if the cache key is not seeded or has been evicted

Queries are **pull-based**. Consumers subscribe to `AggregationUpdated` events as invalidation signals and re-query to obtain updated values.

---

## 12.14 Events (pre-computed)

The pre-computed aggregation system emits:

- `AggregationUpdated`
  - payload: `{ aggregationId, cacheKey }`

  - emitted when an aggregation value changes

- `AggregationRecomputed`
  - payload: `{ aggregationId, cacheKey, reason: string }`

  - emitted after a full recompute completes

Events are informational invalidation signals only.
Consumers must query for current values.

---

## 12.15 Failure and recovery guarantees (pre-computed)

The pre-computed aggregation system must ensure:

- atomic updates to aggregation values and projection caches

- deterministic results given the same Read Model Store state

- safe resumption after crashes or reloads

- no corruption from partial updates

If the system detects inconsistency (e.g., missing projection cache entries), it must trigger a full recompute rather than operate on incomplete data.

---
