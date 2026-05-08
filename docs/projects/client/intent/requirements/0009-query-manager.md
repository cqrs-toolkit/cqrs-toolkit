# 9\. Query Manager (Read Model Access Layer)

## 9.1 Purpose

The Query Manager provides **the sole public read interface** to client-side data for UI and application code.

It exposes **query access to the latest effective state** constructed by the Read Model Store and guarantees that consumers:

- never need to replay events

- never need to understand internal update ordering

- can safely re-query at any time to obtain the most recent snapshot

The Query Manager is **read-only with respect to read-model data**. Pull queries do acquire cache keys, register holds, and emit lifecycle events as side effects (see [§9.5.7](#957-cache-key-lifecycle-delegates)) — `getLocallyById` is the side-effect-free alternative for pure local snapshot reads.

---

## 9.2 Core principles

The Query Manager adheres to the following principles:

- **Snapshot-only reads**  
  All queries return the latest effective snapshot state.

- **Event-agnostic**  
  Consumers do not observe or interpret events to derive state.

- **Offline-first**  
  Queries may be executed when offline or unauthenticated.

- **Eviction-tolerant**  
  Queries must tolerate missing data due to cache eviction.

- **Session-isolated**  
  Data from different user sessions is never mixed.

---

## 9.3 Responsibilities

The Query Manager is responsible for:

- Reading from:
  - the database (offline modes)

  - in-memory stores (online-only mode)

- Exposing ergonomic query APIs for:
  - record lookup by ID

  - list queries scoped by cache key or scope key

  - filtered and paginated lists

  - joins across collections via link tables

- Returning **consistent snapshots** reflecting:
  - server snapshots

  - permanent events

  - anticipated events

- Providing optional metadata about query readiness

The Query Manager does **not**:

- apply events

- mutate read-model data (that is the Sync Manager's job, via the Event Processors — see [§1008](0008-event-processors.md))

- cache results internally beyond the underlying store

- perform network I/O

- coordinate synchronization

---

## 9.4 Query model

The Query Manager is designed for two consumption patterns that can be combined:

**Push (subscribe to library events):** consumers subscribe to library events emitted by the EventBus — `readmodel:updated`, `sync:seed-completed`, `sync:failed`, etc. — to react when underlying state changes. The Query Manager provides typed Observable helpers `watchById` and `watchCollection` (see [§9.5.6](#956-observable-subscriptions)) that project the relevant library events into focused streams; the EventBus is also available for direct subscription.

**Pull (fetch from local state on demand):** `getById`, `getByIds`, `list`, `getLocallyById`, `exists`, and `count` read effective state from the local store. Pull queries return whatever is locally available — they do not block on server data themselves. Higher-level primitives such as the Solid client layer additional behaviors (e.g. "wait for seed completion") on top by combining a pull query with a push subscription.

Combining the two — re-running a pull query in response to a push event — is the standard pattern for building reactive UI on top of the Query Manager.

---

## 9.5 Required query capabilities

At minimum, the Query Manager must support the following conceptual operations:

### 9.5.1 Record lookup

```ts
getById<T>(params: GetByIdParams<TLink>): Promise<QueryResult<TLink, T>>
getByIds<T>(params: GetByIdsParams<TLink>): Promise<Map<string, QueryResult<TLink, T>>>
```

`GetByIdParams` carries `{ collection, cacheKey, id }`; `GetByIdsParams` carries `{ collection, cacheKey, ids: EntityId[] }`.

`QueryResult<TLink, T>` carries `data: T | undefined` (undefined when the record does not exist or has been evicted), a `hasLocalChanges` flag, and `ItemMeta` — change-detection and identity metadata: `{ id, updatedAt, clientId?, revision? }`. `clientId` is present when the entity was created from a temp-ID create command (see [`0014 §14.4`](0014-entity-ref.md#144-id-strategy)); `revision` is present once the entity has been confirmed by the server.

The metadata may be surfaced as a standalone field (`meta: ItemMeta | undefined` alongside `data`) or embedded into the data, whichever proves more practical. Either shape fulfills the intent of providing per-item metadata alongside the data.

---

### 9.5.2 Collection listing

```ts
list<T>(params: ListParams<TLink>): Promise<ListQueryResult<TLink, T>>
```

`ListParams<TLink>` carries `{ collection, cacheKey, filter?, sort?, limit?, cursor? }`. Filtering, sorting, and pagination are applied locally to the result set.

`ListQueryResult<TLink, T>` carries `data: T[]`, an underlying `total` count (may differ from `data.length` under pagination), a `hasLocalChanges` flag for whether any item carries optimistic state, and the `cacheKey: CacheKeyIdentity<TLink>` used for the query.

Each item is accompanied by `ItemMeta` (see [§9.5.1](#951-record-lookup)) — change-detection and identity metadata. The metadata may be surfaced as a standalone parallel array (`meta: ItemMeta[]` aligned with `data`) or embedded into each item, whichever proves more practical. Either shape fulfills the intent of providing per-item metadata alongside the data.

---

### 9.5.3 Cross-collection joins

A real application built on this library needs cross-collection join capability — for example, fetching the notes for a notebook plus their tags in one query, where the relationship is expressed via a link table.

Cross-collection joins:

- run entirely against local data (no network calls)
- take advantage of the active storage backend (in-memory access in Mode A, SQL queries in worker modes)

A dual-mode-aware API shape — the consumer providing both an in-memory implementation and a SQL query, with the library dispatching based on the active `IStorage` — is one approach that fits both backends.

---

### 9.5.4 Local snapshot lookup

```ts
getLocallyById<T>(collection: string, id: EntityId): Promise<T | undefined>
```

Reads straight from the local read-model store without acquiring a cache key, registering holds, emitting events, or reconciling references. Use for quick local lookups where the full `QueryResult` plumbing is not needed.

---

### 9.5.5 Existence and count

```ts
exists(collection: string, id: EntityId): Promise<boolean>
count(collection: string): Promise<number>
```

---

### 9.5.6 Observable subscriptions

```ts
watchById<T>(params: GetByIdParams<TLink>): Observable<T | undefined>
watchCollection(collection: string): Observable<CollectionSignal>
```

`watchById` emits the entity's effective state on every change.

`watchCollection` emits a `CollectionSignal` discriminated union:

- `{ type: 'updated', ids: string[], commandIds: string[] }` — records were updated; `ids` and `commandIds` carry the identifiers involved
- `{ type: 'seed-completed', recordCount: number }` — initial seed completed
- `{ type: 'sync-failed', error: string }` — a sync operation failed

These helpers project the corresponding EventBus events (`readmodel:updated`, `sync:seed-completed`, `sync:failed`) into focused streams; consumers can also subscribe to the EventBus directly when they need broader signal coverage.

---

### 9.5.7 Cache-key lifecycle delegates

The Query Manager exposes thin convenience delegates to the Cache Manager: `touch(cacheKey)`, `hold(cacheKey)`, `release(cacheKey)`, `releaseAll()`. These let UI code register navigation access and active holds without reaching for the Cache Manager directly.

---

## 9.6 Query metadata (optional but recommended)

The Query Manager may expose lightweight metadata queries:

```ts
getCollectionMeta({
  collectionName,
  cacheKey
}) -> {
  seeded: boolean;
  lastUpdatedAt?: number;
}
```

This allows UI code to distinguish:

- “data not yet loaded”

- “data loaded but empty”

- “data partially available”

This metadata is **informational only** and must not be required for correctness.

---

## 9.7 Interaction with anticipated events

- Anticipated events may:
  - update existing records

  - create new records (e.g., optimistic aggregate creation)

- Query results must include these optimistic records immediately once applied.

- Query Manager does not distinguish between authoritative and optimistic records unless explicitly modeled in the data.

---

## 9.8 Interaction with cache eviction

- When a cache key is evicted:
  - subsequent queries scoped to that key return empty results

  - individual record lookups return `null`

- The Query Manager must not throw or error due to eviction.

Eviction is treated as a normal state transition.

---

## 9.9 Offline and unauthenticated behavior

- Queries may be executed:
  - while offline

  - while authentication is unknown

- The Query Manager must return whatever cached data is available.

- It must not block or fail due to lack of network or authentication.

---

## 9.10 Session reset handling

When a session reset occurs (user identity change):

- all read model data is wiped

- all queries return empty results

- no data from the previous session is accessible

The Query Manager must tolerate this transition without error.

---

## 9.11 Failure and recovery guarantees

The Query Manager must ensure:

- deterministic results given the same underlying store state

- safe operation across reloads and crashes

- no leakage of stale or cross-session data

- no dependency on event ordering or internal processing state

---
