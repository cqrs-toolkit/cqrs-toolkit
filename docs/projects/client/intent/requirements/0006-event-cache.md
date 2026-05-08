# 6\. Event Cache (Gap Buffer + Anticipated Event Store)

## 6.1 Purpose

The Event Cache is a **temporary, bounded store** for events that cannot yet be fully applied to the Read Model Store or that exist only provisionally.

It exists to:

- support optimistic updates via anticipated events

- buffer out-of-order permanent events until gaps are repaired

- prevent duplicate processing of events

- trigger and coordinate gap repair and refetch behavior

The Event Cache is **not** a full event store and must not grow without bound.

---

## 6.2 Scope and non-goals

The Event Cache:

- stores only the minimum set of events required for correctness

- is tightly coupled to Sync Manager and Command Queue behavior

- is subject to eviction and retention rules

The Event Cache does **not**:

- act as a source of truth

- guarantee long-term persistence

- expose query APIs to UI consumers

- replace authoritative read model snapshots

---

## 6.3 Event classes handled by the cache

### 6.3.1 Anticipated events

Anticipated events are:

- produced by the Domain Layer during command execution

- written to the Event Cache by the Command Queue

- provisional and optimistic in nature

Anticipated events:

- match server event **type names and overall payload shape**, with one exception: ID fields referencing locally-created entities may carry `EntityRef` values per [0014 §24.5.1](0014-entity-ref.md#1451-entityref-in-anticipated-events), where server-originated events always carry plain strings

- omit server-only fields such as `position` and authoritative `createdAt`

- are associated with a `commandId`

- are marked with `persistence = 'Anticipated'` when stored

They remain valid regardless of which cache keys are currently loaded.

---

### 6.3.2 Permanent events (buffered)

Permanent events originate from the server and are authoritative.

A permanent event is buffered in the Event Cache when:

- it arrives out of order for its stream (revision gap exists), or

- the Read Model Store indicates it cannot yet be applied safely

Permanent events:

- are uniquely identified by `event.id`

- have a globally ordered `position`

- have a stream-local `revision`

---

### 6.3.3 Stateful events

Stateful events:

- are identified by `event.persistence = 'Stateful'`

- have `id` and `createdAt`

- do **not** have `revision` or `position`

They are applied best-effort and may be buffered briefly if processors cannot apply them immediately.

---

## 6.4 Persistence normalization

- If an incoming event does **not** include a `persistence` field, it must be treated as `Permanent`.

- Implementations may normalize this at ingestion time, but normalization is not required as long as behavior is correct.

This rule applies uniformly to events received via WebSocket, REST, or command reconciliation.

---

## 6.5 Storage model

Each Event Cache entry is persisted as a `CachedEventRecord`, attributable to the **current session** and carrying:

**Common fields:**

- `id: string` — event identifier (used for de-duplication)

- `type: string` — event type

- `streamId: string` — owning stream

- `persistence: 'Permanent' | 'Stateful' | 'Anticipated'`

- `data: string` — JSON-serialized event body

- `cacheKeys: string[]` — cache keys this event is associated with (junction-table in SQL, array in memory). Used for cleanup and eviction; not required for correctness. Multi-attribution is supported — an event may legitimately associate with multiple cache keys.

- `createdAt: number` — event timestamp

- `processedAt: number | null` — when the event was applied to the read model; null while the event is still pending application

**Permanent-specific fields (null for Anticipated and Stateful):**

- `position: string | null` — global ordering position (BigInt-as-string for JSON storage compatibility)

- `revision: string | null` — stream-local revision (BigInt-as-string)

**Anticipated-specific fields:**

- `commandId: string | null` — owning command (null for Permanent and Stateful)

---

## 6.6 Retention and deletion rules (hard requirements)

### 6.6.1 Permanent events

Permanent events must be deleted from the Event Cache as soon as:

- they have been successfully applied to the Read Model Store, and

- they are no longer needed for gap detection or repair

A short grace window may be used to detect late or out-of-order arrivals.

Recommended maximum grace window:

- **30 seconds**

---

### 6.6.2 Anticipated events

Anticipated events must be deleted when:

- the associated command succeeds and authoritative state is known, or

- the command is cancelled or fails irrecoverably, or

- a **session reset** occurs due to user identity change

Anticipated events must not survive a session wipe.

---

### 6.6.3 Stateful events

Stateful events may be deleted after:

- successful application, or

- scheduling of an authoritative refetch

They must not accumulate unboundedly.

---

## 6.7 Gap detection and repair coordination

The Event Cache cooperates with the Sync Manager to support gap repair:

- Permanent events are de-duplicated by `event.id`

- Buffered permanent events must not be applied until:
  - all earlier revisions for the same stream are available

- When a gap is detected:
  - the Sync Manager is responsible for fetching missing events

  - fetched events are written back into the Event Cache

The Event Cache itself does not initiate network activity.

---

## 6.8 Interaction with cache eviction

On `CacheKeyEvicted(key)`:

- All Event Cache entries **attributable to that key** must be deleted

- This includes:
  - buffered permanent events

  - stateful events

  - anticipated events with that attribution

Events without cache key attribution (e.g., anticipated events affecting unloaded data) must be retained until normal deletion rules apply.

---

## 6.9 Session reset handling

When a session user mismatch occurs:

- the Event Cache must be **fully cleared**

- all buffered and anticipated events are discarded

- no event from a previous user may survive the reset

This wipe is unconditional and independent of eviction policy.

---

## 6.10 Failure and recovery guarantees

The Event Cache must ensure:

- duplicate events are never applied twice

- buffered events are not lost before they are safe to delete

- partial crashes or reloads do not corrupt gap tracking

- resumption after offline periods preserves correctness

The Event Cache may be aggressively compacted as long as these guarantees are upheld.

---
