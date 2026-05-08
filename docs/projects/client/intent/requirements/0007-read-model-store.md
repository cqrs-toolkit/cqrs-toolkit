# 7\. Read Model Store (Authoritative Snapshot + Effective Overlay)

## 7.1 Purpose

The Read Model Store provides **authoritative, queryable state** for the UI.
It represents the **latest effective view** of domain data, derived from:

- server-provided read model snapshots

- permanent events applied in order

- anticipated events applied optimistically

The Read Model Store is the **only source of truth for UI-visible data**.  
Consumers must never reconstruct state by replaying events.

---

## 7.2 Core principles

The Read Model Store adheres to the following principles:

- **Snapshot-first**: server snapshots establish the baseline state

- **Event-applied**: permanent and anticipated events incrementally update that baseline

- **Overlay-based optimism**: optimistic changes never overwrite server truth

- **Eviction-safe**: cached state may be evicted at any time without invalidating commands

- **Session-isolated**: data from different users is never mixed

---

## 7.3 Data model requirements

Each read model record (`ReadModelRecord`) carries:

- `id: string` — domain identifier.
- `collection: string` — the collection this record belongs to.
- `cacheKeys: string[]` — cache keys this record is associated with (junction table in SQL, array in memory). Multi-attribution is supported — a record may legitimately associate with multiple cache keys.
- `serverData: string | null` — JSON-serialized server baseline. Null for locally-created records that have no server confirmation yet.
- `effectiveData: string` — JSON-serialized effective state (server baseline plus optimistic overlay; equal to `serverData` when no local changes are pending).
- `hasLocalChanges: boolean` — flags whether `effectiveData` diverges from `serverData`.
- `updatedAt: number` — last update timestamp.
- `revision: string | null` — stream revision of the last event that updated this record (BigInt-as-string). Null for locally-created entries before reconciliation.
- `position: string | null` — global position of the last event that updated this record (BigInt-as-string).
- `_clientMetadata: ClientMetadata | null` — client-side identity tracking metadata, set when an anticipated event creates a read model entry from a command with `creates.idStrategy === 'temporary'` (see [0014 §24.4](0014-entity-ref.md#144-id-strategy)). Persists through reconciliation so consumer UI can maintain stable references (selection, URLs) when the server assigns a different permanent ID. Null for server-seeded entries and non-create commands.

This structure allows deterministic recomputation of effective state from `serverData` and the relevant overlay events, and supports stable identity references across temp-ID reconciliation.

---

## 7.4 Server baseline vs effective overlay semantics

### 7.4.1 Baseline storage rules

**Intent.** Keep `serverData` populated only when an overlay exists. When the record has no anticipated events affecting it, `effectiveData` alone is sufficient — duplicating server state into a separate `serverData` field doubles per-record storage for the common case (overlays are rare; on the high end ~1% of records carry one). For an offline-capable client where storage quota is tight, this duplication is undesirable.

**Current implementation deviates** for code simplicity: it keeps `serverData` populated alongside `effectiveData` for confirmed records (so that if an overlay arrives later, the server baseline is already at hand). This is a tolerated deviation, not the design preference. Storage pressure is already a known concern on some platforms (notably iOS), so revisiting is a matter of when we prioritize it — not a wait-for-evidence trigger.

Storage rules under intent:

- When no anticipated events affect a record:
  - `effectiveData` holds the server snapshot

  - `serverData` is absent

  - `hasLocalChanges` is false

- When anticipated events affect a record:
  - `serverData` holds the authoritative server baseline (or null if the entity is locally-created and not yet confirmed)

  - `effectiveData` is computed by applying anticipated events over `serverData` (or directly from anticipated events when `serverData` is null)

  - `hasLocalChanges` is true

---

### 7.4.2 Update order

For a given record, updates must be applied in the following order:

1.  Server snapshot (initial or refreshed)

2.  Permanent events (in revision/position order)

3.  Anticipated events (in deterministic command order)

This order must be preserved across reloads and retries.

---

## 7.5 Deletes and update operations

Reducers signal record changes via `UpdateOperation<T>`:

- `{ type: 'set', data: T }` — replace the record's effective state with `data`.

- `{ type: 'merge', data: Partial<T> }` — shallow-merge `data` into the record's effective state.

- `{ type: 'delete' }` — remove the record.

Reducers wrap the update in a `ProcessorResult<T>` carrying `{ collection, id, update, isServerUpdate }`. The `isServerUpdate` flag distinguishes baseline updates (from server snapshots or permanent events) from optimistic updates (from anticipated events).

A processor that cannot apply an event signals `{ invalidate: true }` (`InvalidateSignal`); the Sync Manager schedules a debounced refetch in response (see [§5.7](0005-sync-manager.md#57-stateful-event-handling)).

For many-to-many relationships:

- link tables are stored as separate read model collections

- link-table updates must be applied atomically with related record updates where possible

---

## 7.6 Storage layout

- Each read model collection is stored as a separate logical store (a SQLite table in worker modes; an in-memory Map in Mode A — see [0001 §1.1](0001-modes-and-constraints.md#11-supported-execution-modes) and the `IStorage` abstraction).

- Aggregated or page-specific views may be implemented as additional tables or views.

- Many-to-many relationships use dedicated link tables (or equivalent in-memory structures).

- All records are attributable to one or more cache keys via the `cacheKeys` junction (indexed in SQL).

The Read Model Store does **not** store events.

---

## 7.7 Interaction with cache eviction

On `CacheKeyEvicted(key)`:

- For each read model record whose `cacheKeys` array includes the evicted key, remove the key from the array.

- If a record's `cacheKeys` array becomes empty after removal, delete the record. Records still attributed to other live cache keys are retained.

- This includes:
  - primary records

  - link-table records

  - derived or aggregated records tied to that key

Eviction must leave the Read Model Store in a consistent state.

---

## 7.8 Interaction with anticipated events

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

## 7.9 Session reset handling

When a session user mismatch occurs:

- the Read Model Store must be **fully cleared**

- all records, across all collections, are deleted

- no data from the previous user may survive

This wipe is unconditional and independent of cache eviction.

---

## 7.10 Failure and recovery guarantees

The Read Model Store must ensure:

- partial updates do not corrupt effective state

- atomicity across related record and link-table updates where required

- safe resumption after crashes, reloads, or offline periods

- deterministic recomputation of effective state from stored baselines and overlays

The Read Model Store may choose batching or checkpoint strategies internally, but correctness must always be preserved.

---
