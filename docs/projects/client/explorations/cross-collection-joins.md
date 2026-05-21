# Cross-collection joins (custom views)

## Context

A real application built on this library needs cross-collection join capability — for example, fetching the notes for a notebook plus their tags in one query, where the relationship is expressed via a link table.

The intent appears in [`§9.5.3`](../intent/requirements/0009-query-manager.md#953-cross-collection-joins) of `0009-query-manager.md`, and [`§7.6`](../intent/requirements/0007-read-model-store.md#76-storage-layout) of `0007-read-model-store.md` explicitly anticipates additional tables for "aggregated or page-specific views." No implementation exists yet.

## Observations

- **2026-05-07.** Initial review. The earlier sketch shape `join<T>({ baseCollection, joinCollection, on, filter? })` captured the goal but didn't account for the dual-backend reality (in-memory in Mode A, SQL in worker modes).
- **2026-05-18.** Scope expanded after a design session that worked the canonical Swifttt views (`projects-in-workspace`, `projects-in-asset`, `tasks-with-assignments`) against the existing infrastructure. Conclusions reshaped this entry from a single `join()` sketch into a registered-view system with multi-cache-key composition, pagination, and gated live invalidation. Scale target raised: views must remain responsive against 1e5 records per cache key across 1e2-3 cache keys (a 10x headroom over the previous app's hard-fail point at ~5000 projects per workspace).
- **2026-05-18 (continued).** Recognized that the same scale pressure applies to `list` reactivity, not just views. Generalized the design to share one invalidation engine across two new paged-subscription surfaces (`watchList`, `watchView`) while keeping `watchCollection` as the coarse low-level escape hatch. Confirmed subscription state is per-window: two windows on the same view + params get independent gate state. Renamed pull view API from `runView` to `getView` for consistency with `getById` / `getByIds` / `list`.
- **2026-05-19.** Event-shape prerequisite landed: enriched `readmodel:updated` with `created` / `updated` / `deleted` buckets and `cacheKeys`; new `CollectionSignal.session-reset` variant projected from `session:destroyed`; both synthetic empty-ids emits dropped. Classification produced at commit time by the read-model store. Followed by design convergence on custom columns: rejected STORED generated columns (storage doubling unacceptable at 1e5 rows under quotas), settled on VIRTUAL throughout — column values aren't duplicated on disk, indexes carry their own storage cost as they do for any indexing strategy. Use cases extended beyond FK columns to status filters, date-range queries, polymorphic FKs, name-prefix search, and aggregations. Composite indexes declared separately from columns to avoid redundant single-column indexes. Library does not provide a SQL builder; the user writes SQL directly, with an optional per-view `transform` step in JS to bridge the SQL-result shape to the memory-path output shape — keeps complex re-shaping in JS where SQLite's weaker JSON support doesn't impose ceremony.
- **2026-05-20.** Gate semantics corrected after the first integration tests surfaced two issues. **First**, cache-key as a hard precondition was wrong: a row visible on the page is relevant when it updates, regardless of which cache key the event reports. The tracked-id check belongs first; the cache-key check is a fallback for ids the subscription doesn't recognize. **Second**, conservative re-fetch on off-page creates / deletes was over-eager: it shifts the visible page on every off-page write, which is worse UX than leaving the current page stable until the user paginates. Resolved by decoupling data re-fetch from count re-fetch — data re-runs only when a tracked id is in the event; count re-runs on any watched-cache-key match (when a count callback is configured). The "page count says 156 but I'm on page 9 of 8" inconsistency becomes a deliberate UX signal that the data has shifted, addressed at the user's next pagination action. Also added optional `memoryCount` / `sql.count` callbacks to `ViewRegistration` for explicit total support; `PagedViewResult.total` surfaces them. Solid `createViewQuery` primitive built on top.
- **2026-05-20 (continued).** Two-trigger gate implementation landed across `QueryManager.watchList`, `QueryManager.watchView`, and both proxy mirrors. Count re-fetch is gated tighter than first proposed: it only fires when the event includes a `created` or `deleted` bucket (the only operations that move the count) AND the event's cache keys intersect the subscription's watched set. Pure off-page updates are dropped on both branches. `Collection.list.total` flag added — gates the count contract for paginated lists (default `false`; `list()` returns `total: undefined` and `watchList` does no count re-fetch). `ListQueryResult.total` made optional (`number | undefined`) to match. `Collection[]` threaded into `QueryManager` + `QueryManagerProxy` so `watchList` can resolve the flag without an RPC round-trip per subscription; adapter configs (`DedicatedWorkerAdapterConfig`, `SharedWorkerAdapterConfig`) grew `collections?` for the main-thread side. Integration test suite added covering both `bootstrapOnlineOnly` (in-memory dispatch) and `bootstrapWorkerSide` (real SQLite via better-sqlite3) — verifies `getView` joins, count callback totals, tracked-id re-emit on embedded asset updates, off-page primary-source creates leaving the visible page stable, and the count branch emitting fresh total without shifting rendered rows.

## Scope

This exploration now covers five interlocking concerns rather than just joins:

1. **Custom columns on managed read-model tables** — so SQL views can filter, sort, and join on indexed columns rather than full-scan JSON, and so list pagination can sort by real columns.
2. **Mode-dispatched view definitions** — registered named views with a sync in-memory implementation and an async SQL implementation. The library dispatches based on the active `IStorage`.
3. **Pagination** — page parameters at the call site, library tracks current-page identity for invalidation. Applies to both `list` and `getView`.
4. **Live invalidation that survives scale** — collection-only re-execution is rejected (false invalidations at 1e5 rows are prohibitive). Two-trigger model: data re-fetch on tracked-id match (events that touch ids currently rendered), count re-fetch on watched-cache-key match (events that may affect totals). Off-page changes never shift the visible page; the count diverging from page contents is a deliberate UX signal.
5. **Two paged-subscription surfaces sharing one invalidation engine** — `watchList` (single-collection paged) and `watchView` (cross-collection composite). Both feed on the enriched event stream and apply the same gates against per-subscription state. `watchCollection` survives as a low-level coarse signal.

## Tentative shape

### Custom columns (prerequisite)

Extend [`ManagedCollectionDef`](../../../../packages/client/src/types/config.ts) with `columns` and `indexes` fields. Columns are SQLite **VIRTUAL** generated columns derived from `_effective_data`; indexes are declared separately to support composite indexes without redundant single-column ones.

```ts
interface ManagedCollectionDef {
  type: 'managed'
  name: string
  columns?: CustomColumn[]
  indexes?: CustomIndex[]
}

interface CustomColumn {
  /** snake_case; no leading `_` (reserved for library bookkeeping columns) */
  name: string
  type: 'TEXT' | 'INTEGER' | 'REAL'
  /** Simple JSONPath into _effective_data — library generates json_extract(_effective_data, '<path>'). */
  path?: JSONPathExpression
  /** Escape hatch — raw SQLite expression dropped into the GENERATED AS (...) clause verbatim. */
  expression?: string
  /** SQLite collating sequence. Default BINARY. NOCASE enables index-backed case-insensitive prefix LIKE. */
  collation?: 'BINARY' | 'NOCASE' | 'RTRIM'
  // exactly one of `path` / `expression` required
}

interface CustomIndex {
  /** Defaults to idx_rm_<table>_<col1>_<col2>... */
  name?: string
  /** Ordered — composite-aware. References declared columns or library-owned columns (e.g. `id`, `updated_at`). */
  columns: readonly string[]
  unique?: boolean
  /** Partial index predicate dropped into WHERE (...) verbatim. */
  where?: string
}
```

DDL generation in [`rm-schema.ts`](../../../../packages/client/src/storage/schema/rm-schema.ts) emits one generated column per `CustomColumn` (always VIRTUAL — see below) and one `CREATE INDEX` per `CustomIndex`. In-memory storage ignores both fields — columns are a SQL-mode concern only; the consumer-facing row shape on both backends remains `JSON.parse(_effective_data)`.

**Storage rationale — VIRTUAL, not STORED.** With STORED, every extracted column value is duplicated on disk alongside its source in `_effective_data`. At 1e5 rows × N projected columns under OPFS quota, that doubling is unacceptable. VIRTUAL columns aren't stored — SQLite computes them on demand. Indexes still store their key values (this is true for any index, independent of generated-column kind), but that's the cost of indexing, not the cost of projection. Result: zero row-level storage overhead for columns, index storage only for the indexes the consumer explicitly declares.

**`ALTER TABLE` consequence**: SQLite restricts `ALTER TABLE ADD COLUMN` for generated columns to VIRTUAL only. Using VIRTUAL on initial create keeps fresh-create DDL and migration-add DDL uniform — no policy split between the two paths.

**Use-case coverage.** The shape handles:

- **FK columns** for joins: `{ name: 'workspace_id', path: '$.workspaceId' }`.
- **Discrete filters** (status, kind, role): same shape, indexed via composite.
- **Date ranges**: `INTEGER` for ms-epoch or `TEXT` for ISO, range scans use the index.
- **Polymorphic FKs**: two columns (`<field>_type` + `<field>_id`), composite-indexed together; one composite index per polymorphic field.
- **Prefix name search**: `collation: 'NOCASE'` so `LIKE 'foo%'` is index-resolved, or an `expression` column like `lower(json_extract(_effective_data, '$.name'))` indexed normally.
- **Aggregations** (`SELECT COUNT(*) FILTER (WHERE status IN (...)) FROM ... WHERE project_id = ?`): driven by the same columns and indexes as filter queries. Partial indexes (`indexes[].where`) are available when the FILTER predicate is hot enough to specialize.

Substring `LIKE '%foo%'` is out of scope — that's FTS5 territory, which lives as a separate virtual table the consumer creates via a `library` migration step, not via `ManagedCollectionDef`.

**Constraint:** any column the view's SQL `ORDER BY` references on the storage row, plus any column referenced by `joinSources.fromPath`, must be declared here — otherwise the SQL impl can't index against it.

### View registration

Views are part of `CqrsConfig` (alongside `collections` and `processors`), so the worker boundary doesn't need to serialize closures — both main thread and worker import the same config module by reference.

```ts
interface ViewRegistration<TLink, TParams, TRow, T = TRow> {
  name: string

  /** FROM table — primary source for tracked-id matching in watchView. */
  primarySource: string

  /** Embed targets — contribute to embedIds tracking for the join-source branch. */
  joinSources: readonly { collection: string; fromPath: JSONPathExpression }[]

  /** Resolved cache key set for this params combination. */
  cacheKeys: (params: TParams) => CacheKeyTemplate<TLink>[]

  /** In-memory implementation: sync, full collection iteration. Returns `T` directly. */
  memory: (api: ViewLocalApi, params: TParams) => T[]

  /** Optional total-count callback. Drives the count re-fetch trigger; surfaces as PagedViewResult.total. */
  memoryCount?: (api: ViewLocalApi, params: TParams) => number

  /** SQL implementation: user-authored SQL plus optional row transform and count query. */
  sql: {
    /** Produces the SQL string and bindings. Library executes it verbatim. */
    query: (params: TParams, page: PageRange) => { sql: string; bindings: unknown[] }
    /**
     * Optional count query. Library runs alongside `query` and surfaces the first
     * column of the first row as PagedViewResult.total. Typical shape:
     * SELECT COUNT(*) FROM rm_<table> WHERE ...
     */
    count?: (params: TParams) => { sql: string; bindings: unknown[] }
    /**
     * Per-row JS reshape from the SQL projection (`TRow`) to the public row (`T`).
     * Absent ⇒ `T == TRow`; library returns SQL rows as-is. Sync — rows are already in memory.
     */
    transform?: (row: TRow) => T
  }
}
```

Both implementations are required even for single-mode apps, to avoid mode-availability footguns.

**Two generic parameters.** `TRow` is the raw SQL projection — whatever shape the user's `SELECT` returns. `T` is the public view row, identical to what `memory` produces and what UI code consumes. When the two coincide (consumer's SQL projects the final shape directly), the `T = TRow` default collapses the type-system surface to one parameter. When they differ (the common case for joined embeds — SQL projects JSON strings, JS reshapes), the consumer declares both.

**User owns the SQL.** No library SQL builder. No row mapper hook beyond `transform`. The library executes the user's `{ sql, bindings }` verbatim and either returns rows as-is (no transform) or runs `transform` over each row. SQLite's weaker JSON support compared to Postgres makes elaborate server-side JSON shaping ceremonious; `transform` is the seam that lets the consumer keep that work in JS where it's natural, without leaking mode-specific reshaping into UI code.

**Pagination.** The user writes `LIMIT/OFFSET` (or cursor `WHERE`) directly inside their SQL. The library receives `page: PageRange` so it knows page boundaries for the invalidation gates, but never rewrites or appends to the SQL string. Bindings include the page values when the SQL needs them.

**Worked example — projects-in-workspace join:**

```ts
type SqlRow = { project: string; asset: string | null }
type ProjectWithAsset = Project & { _embedded: { 'pms.Asset': Asset | null } }

const projectsInWorkspace: ViewRegistration<
  ServiceLink,
  { workspaceId: string },
  SqlRow,
  ProjectWithAsset
> = {
  name: 'projects-in-workspace',
  primarySource: 'projects',
  joinSources: [{ collection: 'assets', fromPath: '$._embedded["pms.Asset"].id' }],
  cacheKeys: (p) => [projectScope(p.workspaceId), assetScope()],

  memory: (api, params) => {
    const assets = new Map<string, Asset>()
    for (const a of api.iterate<Asset>('assets')) assets.set(a.id, a.data)
    const out: ProjectWithAsset[] = []
    for (const p of api.iterate<Project>('projects')) {
      if (p.data.workspaceId !== params.workspaceId) continue
      const asset =
        p.data.association?.type === 'Asset' ? (assets.get(p.data.association.id) ?? null) : null
      out.push({ ...p.data, _embedded: { 'pms.Asset': asset } })
    }
    return out
  },

  sql: {
    query: (params, page) => ({
      sql: `
        SELECT p._effective_data AS project, a._effective_data AS asset
        FROM rm_projects p
        LEFT JOIN rm_assets a
          ON p.association_type = 'Asset' AND p.association_id = a.id
        WHERE p.workspace_id = ?
        ORDER BY p.updated_at DESC, p.id DESC
        LIMIT ? OFFSET ?
      `,
      bindings: [params.workspaceId, page.limit, page.offset],
    }),
    transform: (row) => {
      const project = JSON.parse(row.project) as Project
      const asset = row.asset ? (JSON.parse(row.asset) as Asset) : null
      return { ...project, _embedded: { 'pms.Asset': asset } }
    },
  },
}
```

Shape parity between `memory` and the post-`transform` SQL output is the consumer's responsibility — the library validates neither.

### `ViewLocalApi` (online-mode surface)

Tight subset — one method, no `getById`, no `count`, no `exists`. Consumer builds whatever indexes they need from the iterator.

```ts
interface ViewLocalApi {
  iterate<T>(collection: string): Iterable<{ id: string; data: T; hasLocalChanges: boolean }>
}
```

Not part of [`IStorage`](../../../../packages/client/src/storage/IStorage.ts) — a Mode-A-only contract that [`InMemoryStorage`](../../../../packages/client/src/storage/InMemoryStorage.ts) exposes directly, surfaced through the view dispatch path. `IStorage` stays honest as the async cross-mode interface.

`hasLocalChanges` rides on each yielded row so the library can roll up `ViewResult.hasLocalChanges` without a second scan; the consumer can ignore it if irrelevant.

### Cross-cache-key composition

Views compose records from multiple cache keys. `tasks-with-assignments` reads tasks under the project scope key, users under either the tenant scope or global user scope key, and teams under the tenant scope key. The view declares all of them via `cacheKeys(params)`; the library uses this set for the invalidation gate below.

**Hold semantics (V1 default — assume ambient):** `getView` does not auto-acquire the declared keys. The consumer's existing UI/routing has already acquired them; missing data renders as null embeds. Auto-acquire / seed-on-demand can be added later as opt-in flags on the registration if real consumers need it.

### Pagination

Page params live at the call site, not the registration. Cursor-based pagination is preferred for live data (stable boundaries under inserts/deletes), but offset is supported via discriminated union.

```ts
type PageRange =
  | { kind: 'offset'; limit: number; offset: number }
  | { kind: 'cursor'; limit: number; after?: unknown[] }   // sort-column values

getView<T>({ view, params, page?: PageRange }): Promise<PagedViewResult<TLink, T>>
watchView<T>({ view, params, page?: PageRange }): Observable<{ data: T[]; total?: number }>
```

The view's `sql` builder inlines `LIMIT/OFFSET` (or cursor `WHERE` clause). The library doesn't wrap the consumer's SQL — wrapping is brittle once GROUP BY, joins, or cursor predicates enter the picture.

`total` is consumer-supplied via the view's row shape or a side `total` field on `PagedViewResult` — not library-computed. Counting is expensive and the consumer knows when they need it.

Mode-A pagination: the online closure returns the full computed result; the library slices `[offset, offset+limit]`. Wasteful by design; Mode A is the in-memory escape hatch and large datasets are out of scope for it.

### Subscription state is per-window, not per-(view, params)

Each call to `watchView` / `watchList` creates its own subscription with its own page state — `pageIds`, `embedIds`, `watchedCacheKeys`, the last emitted total. Two windows on the same view + params + page each get an independent subscription. They share no gate state and re-run independently.

The worker hosts the invalidation engine. Each `readmodel:updated` triggers iteration over every live subscription; each subscription's two re-fetch triggers run against its own state. Notifications route back to the originating window via the existing `windowId` plumbing (already first-class through [`QueryManagerFacade.holdForWindow`](../../../../packages/client/src/core/query-manager/QueryManagerFacade.ts) and `releaseForWindow`). On window close, all that window's subscriptions tear down with the rest of the window-scoped state.

Pull `getView` carries no subscription state — one-shot read, no tracking.

Deduplication of identical subscriptions across windows (same view, same params, same page) is **deferred**. Two windows on the same page mean two SQL executions in V1; acceptable cost. A dedup layer keyed by (view, params-hash, page-hash) can land later if measurements show it matters.

### Live invalidation — two independent re-fetch triggers

The library tracks per active `watchView` / `watchList` subscription:

- `watchedCacheKeys: Set<string>` — resolved from `cacheKeys(params)`.
- `pageIds: string[]` — primary-source IDs currently visible, in order.
- `embedIds: Map<collection, Set<string>>` — FK values referenced by visible rows, per join source, extracted via each `joinSources.fromPath`. (`watchView` only.)

Two re-fetch triggers fire independently against each `readmodel:updated` event. Both feed into the same emission stream; coalesced when a single event matches both.

**Data re-fetch — fires on a tracked-id match.**

```
event.collection ∈ watched sources ?                   no  → no data re-fetch
let tracked = (event.collection == primarySource)
              ? pageIds
              : embedIds[event.collection]
any id ∈ (event.created ∪ event.updated ∪ event.deleted) is in tracked ?
  yes → re-run data query, emit
  no  → no data re-fetch
```

The cache-key attribution on the event doesn't matter here. If a visible row is in the event, it's relevant — the row IS what we're rendering. Re-fetch.

**Count re-fetch — fires on a watched-cache-key match (when a count callback is configured).**

```
view declares memoryCount / sql.count ?               no  → no count re-fetch (no total to update)
event.collection ∈ watched sources ?                  no  → no count re-fetch
event.cacheKeys ∩ watchedCacheKeys ≠ ∅ ?              no  → no count re-fetch
                                                      yes → re-run count, emit with new total + previous data
```

The count callback is the only signal for live totals in views that don't surface per-row changes affecting the visible page (creates landing off-page, deletes off-page, etc.). Without a count callback, the count branch is dead — and that's the consumer's choice (no `total` field needed, no re-fetch traffic for off-page changes).

**Coalescing.** If a single event matches both triggers (some tracked id ∈ event AND event.cacheKeys ∩ watched), the data re-fetch wins: it re-runs both data and count atomically. The standalone count branch only fires when the tracked-id branch didn't.

**Why off-page changes don't re-fetch data.**

Earlier drafts of this design treated primary-source creates / deletes within watched cache keys as page-shifting events that warranted a re-fetch. Reality: re-fetching shifts the visible rows, which is worse UX than leaving the page stable. The user is reading row 13; an off-page delete suddenly turns it into row 12 with different content.

Off-page changes show up via the count instead: "Showing 1-20 of 156" becomes "Showing 1-20 of 157" — the count is now ahead of what the page can display. That divergence is a legitimate UX signal: the user knows new data has arrived and can paginate or refresh to see it.

**Bulk re-check signals (unchanged).**

`sync:seed-completed` for a watched collection, `session:destroyed`, and `cache:evicted` for a watched key all bypass both gates and force a full re-fetch (data + count). They represent "the world changed under you" — gates can't reason about it usefully.

**Cost at scale.** At 1e5 records across 1e2-3 cache keys:

- Off-collection events: filtered immediately (collection set check). Zero per-row work.
- On-collection events with no tracked-id and no cache-key match: dropped. Zero queries.
- On-collection events that hit only the cache-key branch: one count query (typically indexed `SELECT COUNT(*) WHERE ...`, resolves in ms).
- On-collection events that hit the tracked-id branch: one data query (LIMIT-bounded; resolves in ms).

### No library SQL builder

The library does not ship a SQL builder or WHERE-filter helper. Consumers write SQL directly as `{ sql: string, bindings: unknown[] }`. Rationale:

- A library-maintained builder accretes API surface every time an edge case (window functions, recursive CTEs, `JSON_EACH` joins, dialect-specific quirks) doesn't fit cleanly. Consumers learn the builder's vocabulary on top of SQLite's, and hit friction the moment the builder doesn't express their intent.
- SQLite's full surface — partial indexes, window functions, FTS5, JSON1, recursive CTEs, virtual tables — is directly available to the consumer when they write raw SQL.
- The only library-imposed friction points are the DDL regime (column / index declarations above) and the `?`-placeholder binding format.

Consumers who want template-string ergonomics for parameterized queries can use any helper they choose locally (e.g. `sql-template-strings`'s `.sql` / `.values` getters produce SQLite-shaped output). The library accepts the `{ sql, bindings }` primitive only.

## Prerequisites (must land before paged-subscription layer)

1. **`readmodel:updated` event enrichment.** Current shape `{ collection, ids, commandIds }` ([`types/events.ts`](../../../../packages/client/src/types/events.ts)) is insufficient for the three-gate invalidation. Required changes:
   - **Per-op buckets** — replace `ids: string[]` with three optional buckets `created?: string[]; updated?: string[]; deleted?: string[]`. Each yielded id falls in exactly one bucket per emit; empty buckets are omitted from the payload. Maps directly onto gate access patterns (Gate 2 reads `updated`; Gate 3 reads `created` and `deleted`) without per-emit filtering, and consumers can `new Set(event.created)` or `event.updated?.includes(id)` directly. Classification happens at commit time inside the read-model store, which knows whether each row pre-existed.
   - **Cache keys per event** — `cacheKeys: string[]` union. Drives Gate 1.

   Three real emit sites need migration ([AnticipatedEventHandler](../../../../packages/client/src/core/command-lifecycle/AnticipatedEventHandler.ts) and two in [SyncManager](../../../../packages/client/src/core/sync-manager/SyncManager.ts)). The DevTools event pane and Sync Manager debug surfaces both benefit independently of paged subscriptions.

   **No new bulk-invalidate event needed.** The two synthetic empty-ids emits in [SyncManager](../../../../packages/client/src/core/sync-manager/SyncManager.ts) (after session reset, after seed completion) are replaced by existing first-class events:
   - **Seed-completion synthetic emit is redundant.** `watchCollection` already projects `sync:seed-completed` into `CollectionSignal.seed-completed`, and reactive consumers ([createListQuery](../../../../packages/client-solid/src/createListQuery.ts), [createItemQuery](../../../../packages/client-solid/src/createItemQuery.ts)) re-fetch on it. Drop the synthetic emit; nothing else changes.
   - **Session-reset synthetic emit** is currently the only signal for the rare case where a session resets without the consumer's cacheKey accessor changing. Replace with a new `CollectionSignal.session-reset` variant projected from `session:destroyed` (or `session:changed`). Paged subscriptions also listen to `session:changed` / `cache:evicted` directly for tear-down / refetch.

2. **Custom-column support** ([`ManagedCollectionDef.columns`](../../../../packages/client/src/types/config.ts), [`rm-schema.ts`](../../../../packages/client/src/storage/schema/rm-schema.ts) DDL, write-path extraction). Required before any SQL view can index/sort/join meaningfully, and before `watchList` can sort by anything other than the existing standard columns.

3. **`sort` field added to `ListParams`** ([`query-manager/types.ts`](../../../../packages/client/src/core/query-manager/types.ts)). Cursor pagination requires explicit sort columns to define cursor positions, and Gate 3's boundary check needs to know which columns to compare. `sort` becomes load-bearing for both `list` and `watchList`.

## Tentative working assumptions

These will harden into ADRs as the implementation lands:

- Views are registered on `CqrsConfig.views` and shared by main thread and worker via the same config module (parallel to `collections` and `processors`).
- The `memory` impl is **sync** and returns the full result before slicing; the `sql` impl is async, returns `{ sql, bindings }`, and optionally provides a sync `transform` for per-row JS reshape.
- Both impls are required for every view (no `memory`-only or `sql`-only variants in V1).
- `ViewLocalApi` exposes only `iterate(collection)` — nothing more.
- The library does not auto-acquire declared cache keys; the consumer's UI owns hold lifecycle (assume-ambient).
- Embed missing-data: SQL `LEFT JOIN` returns null embeds; memory impl follows the same convention. No "drop the row" semantics in V1.
- The library does not ship a SQL builder. Consumers write raw `{ sql, bindings }`.
- Custom columns are always **VIRTUAL** generated columns (no STORED variant exposed). Indexes are declared separately and may be composite, unique, or partial.
- Pagination clauses (`LIMIT`/`OFFSET` or cursor `WHERE`) live in the user's SQL; the library passes `page: PageRange` to the query builder but never edits the SQL string.
- **Two independent re-fetch triggers** per subscription: data on tracked-id match, count on watched-cache-key match. Coalesced when a single event matches both — data re-fetch wins.
- **Off-page changes never shift the visible page.** The count diverging from displayed rows is a deliberate UX signal, not a bug.
- **Count is optional on `watchView`** — declared via `memoryCount` / `sql.count` on the registration. Views without a count callback have a dead count branch and surface no `total`.

## Open questions

- **`watchList` count branch — always on, or opt-in?** `readModelStore.count(collection, cacheKey)` is always available, so `watchList` has a "free" count callback. Two interpretations: (a) always run count re-fetch on cache-key match — consumers get live totals for free; (b) opt-in via a flag, matching the explicit `memoryCount` / `sql.count` shape on views. Default lean is (a) — list queries are paginated UI by convention and want live totals.
- **`watchView` total emission policy.** When the count branch fires but the count value hasn't actually changed (compute → same number), do we still emit? Cheapest is always-emit (let the consumer debounce). Tighter is suppress-on-equal. Current lean: always-emit for V1 simplicity; revisit if observation shows downstream emit-spam.
- **`watchList` initial fetch shape.** Today `list()` returns `{ data, meta, total }` atomically. Tracked-id data re-fetch reuses this — data + total move together. Confirming this stays the contract and we don't split `list` into data-only / count-only methods.
- **Page contract V1 surface.** Ship both offset and cursor as a discriminated union, or start with one? Cursor is the durable choice but offset is what backend pagination defaults look like — and existing app pagination is often offset-based. May need both from day one.
- **`hasLocalChanges` aggregation on `PagedViewResult`.** Per-row from the iterator yield is decided; the rollup at the view-result level should be the OR across the visible page.
- **JSONPath subset for `joinSources.fromPath` and column extraction.** Should match the [EntityRef path subset](../intent/requirements/0014-entity-ref.md) (root, dot member, bracket member, wildcard, index — no slice, union, recursive descent, filter) so the same implementation serves both. Bracket-member-with-dot (`$._embedded['pms.Asset'].id`) verified 2026-05-19 — parser already handles it.
- **Embed shape conventions** (`$._embedded['pms.Asset']` vs `$.asset` vs `{ service, type, instance }` polymorphic wrapping). Consumer-owned per view — library doesn't model. Worth documenting in a Swifttt-side convention rather than this exploration.

## Alternatives considered

- **Library-provided SQL-like predicate engine that compiles to both backends.** Too much engineering for what is effectively an escape hatch. Defer.
- **In-memory-only joins (require Mode A semantics in worker modes too).** Defeats the SQL-backend efficiency advantage; pulls 1e5-row collections into JS memory on every query.
- **Single cache key per view.** Rejected — the canonical examples are cross-cache-key by construction.
- **Async `ViewLocalApi`** with `getById` / `getByIds`. Rejected — Mode A is sync; an async wrapper just adds latency and forces the consumer to await per access. Sync iteration over the in-memory map is honest about the runtime model.
- **Any-event re-execution.** Rejected at the 2026-05-18 session on scale grounds.
- **Custom SQL template helper instead of `sql-template-strings`.** Initially considered shipping a `SqliteWhereFilter` helper to mirror the server-side builder. Rejected (2026-05-19): no library SQL builder at all. Consumers write `{ sql, bindings }` directly and use whatever local helper they prefer for template-string ergonomics. Avoids the API-accretion problem ORMs hit when edge cases don't fit the builder's vocabulary.
- **STORED generated columns for custom columns.** Initially proposed for faster column reads. Rejected (2026-05-19) on storage grounds: STORED duplicates column values on disk alongside `_effective_data`, doubling row storage at 1e5 rows across many cache keys under OPFS quotas. VIRTUAL columns are zero-cost per row; indexes carry the only storage overhead, which is intrinsic to indexing.
- **Imperative DDL (user writes CREATE TABLE, library ALTERs in bookkeeping columns).** Mechanically simple (sequence of `ALTER TABLE ADD COLUMN`), but breaks cross-mode parity (in-memory storage has no columns; if user-authored columns are primary truth, mode-A has to fake them) and doubles the authoring surface (DDL string + write-path JSON→column mapping). Declarative path/expression projections cover the same cases with one declaration per column, deriving DDL deterministically.
- **Library row mapper hook (`mapSqlRow: (raw) => TRow`) decoupled from `sql`.** Considered for normalizing SQL JSON-string columns back to objects. Rejected because it bled toward a coercion layer. Instead, the `sql.transform` field bundles the reshape with the query that produced it, keeping mode-specific knowledge inside the view registration and out of UI code.
- **Cache-key as a hard precondition for any re-fetch.** Earlier draft put cache-key intersection as Gate 1 before checking tracked ids. Rejected (2026-05-20): a row visible on the page IS what the user is reading; an update to that row is relevant regardless of which cache key the event reports. Cache-key match belongs as a fallback signal for ids the subscription doesn't recognize, not as a precondition for relevance.
- **Conservative page-shift re-fetch on primary-source creates / deletes.** Earlier draft re-fetched the data query on any create / delete in a watched cache key (treating page composition as potentially affected). Rejected (2026-05-20): off-page changes shouldn't shift the visible page — the user is reading row 13, and re-fetching to make it row 12 with different content is worse UX than leaving the page alone. Off-page changes surface via the count, which can outpace what the page can display ("Showing 1-20 of 156" with 157 newly arrived) and signals to the user that the data has moved. The count is updated by an independent re-fetch trigger on watched-cache-key match; the data query never re-fetches for ids it doesn't currently track.
- **Sort-boundary fast-path on Gate 3.** Earlier draft proposed a per-row sort-key comparison to decide whether a create / delete falls inside the visible page boundary, skipping the re-fetch when outside. Obsoleted (2026-05-20): with the data query no longer re-fetching on off-page changes at all, there's nothing for a boundary fast-path to optimize.

## Status

Active — V1 implementation landed end-to-end. Design is ready to graduate into the requirements wing.

**Landed:**

- Event-shape enrichment: `readmodel:updated` carries `created` / `updated` / `deleted` buckets and `cacheKeys`; `CollectionSignal.session-reset`; synthetic empty-ids emits dropped.
- Custom-column DDL: VIRTUAL generated columns with `path` / `expression` / `collation`; separate `CustomIndex` declarations (composite, unique, partial); migration validation.
- `ListParams.sort` (composite ordering) threaded through `IStorageQueryOptions`, `InMemoryStorage`, `SQLiteStorage`, `ReadModelStore.list`.
- View types (`ViewRegistration`, `ViewLocalApi`, `PageRange`, `PagedViewResult`); `ViewExecutor` with in-memory + SQL dispatchers; `CqrsConfig.views`.
- `getView` (pull) + `watchView` (paged subscription, cross-collection) on `IQueryManager`; facade + proxy + StableRef delegation.
- `watchList` (paged subscription, single collection) on `IQueryManager`, with engine in QueryManager + main-thread mirror in QueryManagerProxy.
- Optional count callbacks: `memoryCount` on memory path, `sql.count` on SQL path. `PagedViewResult.total` populated when configured.
- `Collection.list.total` flag — opts a collection into live totals on both `list()` (returns `total`) and `watchList` (issues count re-fetches). Default `false` keeps the contract honest with future pull-side rework.
- `Collection[]` threaded through `QueryManager` and `QueryManagerProxy` (via `DedicatedWorkerAdapterConfig.collections` / `SharedWorkerAdapterConfig.collections`) so the flag resolves locally without RPC round-trips.
- Two-trigger gate model implemented across inner QueryManager and proxy: data re-fetch on tracked-id match (cache-key attribution doesn't gate), count re-fetch on watched-cache-key match with create/delete in the event (only ops that can move the count). Off-page changes never shift the visible page.
- Solid `createViewQuery` primitive with reactive `params` / `page` accessors and `total` exposed in state.
- JSONPath bracket-with-dot verified for `_embedded['pms.Asset'].id` canonical embed paths.
- Integration tests covering both bootstrap variants (`bootstrapOnlineOnly` + `bootstrapWorkerSide` with real SQLite via better-sqlite3): `getView` joins, count callback totals, tracked-id re-emit on embedded asset updates, off-page primary-source create stability, count branch emitting fresh total without rendering shift.

**Next concrete steps:**

1. Resolve any remaining open questions above.
2. Graduate this exploration into a proper `requirements/NNNN-views.md` entry. The accompanying ADRs (one or several) document the load-bearing decisions: VIRTUAL columns, `sql.transform`, assume-ambient holds, two-trigger invalidation, count-on-cache-key-match, `Collection.list.total` opt-in, off-page-stable page semantics.
3. Consumer-side documentation in the Swifttt frontend repo (how to register views, how `createScopeCacheKey` ambient holds compose with view subscriptions).
