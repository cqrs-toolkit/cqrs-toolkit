# 8\. Query Manager (Read Model Access Layer)

## 8.1 Purpose

The Query Manager provides **the sole public read interface** to client-side data for UI and application code.

It exposes **query access to the latest effective state** constructed by the Read Model Store and guarantees that consumers:

- never need to replay events

- never need to understand internal update ordering

- can safely re-query at any time to obtain the most recent snapshot

The Query Manager is **read-only** and never mutates state.

---

## 8.2 Core principles

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

## 8.3 Responsibilities

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

- cache results internally beyond the underlying store

- perform network I/O

- coordinate synchronization

---

## 8.4 Query model

All Query Manager APIs are **pull-based**.

Consumers are expected to:

1.  subscribe to library events as invalidation signals

2.  re-run queries to obtain updated state

The Query Manager does not push data updates.

---

## 8.5 Required query capabilities

At minimum, the Query Manager must support the following conceptual operations:

### 8.5.1 Record lookup

```ts
getById<T>({
  collectionName,
  id
}) -> Promise<T | null>
```

- Returns the latest effective snapshot for the record.

- Returns `null` if the record does not exist or has been evicted.

---

### 8.5.2 Collection listing

```ts
list<T>({
  collectionName,
  cacheKey,
  filter?,
  sort?,
  limit?,
  cursor?
}) -> Promise<{ items: T[]; nextCursor?: string | null }>
```

- Returns records belonging to a cache key or scope key.

- Filtering, sorting, and pagination are applied locally.

- Results reflect the latest effective snapshot.

---

### 8.5.3 Cross-collection joins (optional)

```ts
join<T>({
  baseCollection,
  joinCollection,
  on,
  filter?
}) -> Promise<T[]>
```

- Joins are performed locally using link tables or precomputed relations.

- Joins must not perform network calls.

---

## 8.6 Query metadata (optional but recommended)

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

## 8.7 Interaction with anticipated events

- Anticipated events may:
  - update existing records

  - create new records (e.g., optimistic aggregate creation)

- Query results must include these optimistic records immediately once applied.

- Query Manager does not distinguish between authoritative and optimistic records unless explicitly modeled in the data.

---

## 8.8 Interaction with cache eviction

- When a cache key is evicted:
  - subsequent queries scoped to that key return empty results

  - individual record lookups return `null`

- The Query Manager must not throw or error due to eviction.

Eviction is treated as a normal state transition.

---

## 8.9 Offline and unauthenticated behavior

- Queries may be executed:
  - while offline

  - while authentication is unknown

- The Query Manager must return whatever cached data is available.

- It must not block or fail due to lack of network or authentication.

---

## 8.10 Session reset handling

When a session reset occurs (user identity change):

- all read model data is wiped

- all queries return empty results

- no data from the previous session is accessible

The Query Manager must tolerate this transition without error.

---

## 8.11 Failure and recovery guarantees

The Query Manager must ensure:

- deterministic results given the same underlying store state

- safe operation across reloads and crashes

- no leakage of stale or cross-session data

- no dependency on event ordering or internal processing state

---
