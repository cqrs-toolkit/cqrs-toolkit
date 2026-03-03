# 6\. Read Model Store (Authoritative Snapshot + Effective Overlay)

## 6.1 Purpose

The Read Model Store provides **authoritative, queryable state** for the UI.
It represents the **latest effective view** of domain data, derived from:

- server-provided read model snapshots

- permanent events applied in order

- anticipated events applied optimistically

The Read Model Store is the **only source of truth for UI-visible data**.  
Consumers must never reconstruct state by replaying events.

---

## 6.2 Core principles

The Read Model Store adheres to the following principles:

- **Snapshot-first**: server snapshots establish the baseline state

- **Event-applied**: permanent and anticipated events incrementally update that baseline

- **Overlay-based optimism**: optimistic changes never overwrite server truth

- **Eviction-safe**: cached state may be evicted at any time without invalidating commands

- **Session-isolated**: data from different users is never mixed

---

## 6.3 Data model requirements

Each read model record must include:

- `id: string`  
  Domain identifier for the record.

- `cacheKey: string`  
  The cache key (entity or scope) this record belongs to.

- `data: T`  
  The **effective state** (server baseline plus optimistic overlay).

- `server?: T`  
  Optional server-only baseline when optimistic overlays are present.

This structure allows deterministic recomputation of effective state.

---

## 6.4 Server baseline vs effective overlay semantics

### 6.4.1 Baseline storage rules

- When no anticipated events affect a record:
  - store the server snapshot directly in `data`

  - ensure `server` is absent

- When anticipated events affect a record:
  - store the authoritative snapshot in `server`

  - compute `data` by applying anticipated events over `server`

---

### 6.4.2 Update order

For a given record, updates must be applied in the following order:

1.  Server snapshot (initial or refreshed)

2.  Permanent events (in revision/position order)

3.  Anticipated events (in deterministic command order)

This order must be preserved across reloads and retries.

---

## 6.5 Deletes and link-table handling

Reducers must explicitly signal record changes via operations:

- `{ op: 'upsert', modified: boolean, value: T }`

- `{ op: 'delete' }`

- `{ op: 'none' }`

For many-to-many relationships:

- link tables are stored as separate read model collections

- link-table updates must be applied atomically with related record updates where possible

---

## 6.6 Storage layout

- Each read model collection is stored in a SQLite table.

- Aggregated or page-specific views may be implemented as additional tables or views.

- Many-to-many relationships use dedicated link tables.

- All records must be attributable to a `cacheKey` (indexed column).

The Read Model Store does **not** store events.

---

## 6.7 Interaction with cache eviction

On `CacheKeyEvicted(key)`:

- All read model records with `cacheKey === key` must be deleted.

- This includes:
  - primary records

  - link-table records

  - derived or aggregated records tied to that key

Eviction must leave the Read Model Store in a consistent state.

---

## 6.8 Interaction with anticipated events

- Anticipated events may affect:
  - records already present in the Read Model Store

  - records that will be loaded later via snapshot or event replay

  - new records created by the event

- The Read Model Store must apply anticipated events whenever relevant records exist.

- Eviction of cached data does **not** invalidate anticipated events; they remain in the Event Cache until resolved.

When authoritative state arrives:

- anticipated overlays are discarded or rebased

- effective state is recomputed deterministically

---

## 6.9 Session reset handling

When a session user mismatch occurs:

- the Read Model Store must be **fully cleared**

- all records, across all collections, are deleted

- no data from the previous user may survive

This wipe is unconditional and independent of cache eviction.

---

## 6.10 Failure and recovery guarantees

The Read Model Store must ensure:

- partial updates do not corrupt effective state

- atomicity across related record and link-table updates where required

- safe resumption after crashes, reloads, or offline periods

- deterministic recomputation of effective state from stored baselines and overlays

The Read Model Store may choose batching or checkpoint strategies internally, but correctness must always be preserved.

---
