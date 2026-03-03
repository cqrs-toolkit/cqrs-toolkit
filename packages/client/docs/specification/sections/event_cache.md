# 5\. Event Cache (Gap Buffer + Anticipated Event Store)

## 5.1 Purpose

The Event Cache is a **temporary, bounded store** for events that cannot yet be fully applied to the Read Model Store or that exist only provisionally.

It exists to:

- support optimistic updates via anticipated events

- buffer out-of-order permanent events until gaps are repaired

- prevent duplicate processing of events

- trigger and coordinate gap repair and refetch behavior

The Event Cache is **not** a full event store and must not grow without bound.

---

## 5.2 Scope and non-goals

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

## 5.3 Event classes handled by the cache

### 5.3.1 Anticipated events

Anticipated events are:

- produced by the Domain Layer during command execution

- written to the Event Cache by the Command Queue

- provisional and optimistic in nature

Anticipated events:

- match server event type names and payload shape

- omit server-only fields such as `position` and authoritative `createdAt`

- are associated with a `commandId`

- are marked with `persistence = 'Anticipated'` when stored

They remain valid regardless of which cache keys are currently loaded.

---

### 5.3.2 Permanent events (buffered)

Permanent events originate from the server and are authoritative.

A permanent event is buffered in the Event Cache when:

- it arrives out of order for its stream (revision gap exists), or

- the Read Model Store indicates it cannot yet be applied safely

Permanent events:

- are uniquely identified by `event.id`

- have a globally ordered `position`

- have a stream-local `revision`

---

### 5.3.3 Stateful events

Stateful events:

- are identified by `event.persistence = 'Stateful'`

- have `id` and `createdAt`

- do **not** have `revision` or `position`

They are applied best-effort and may be buffered briefly if processors cannot apply them immediately.

---

## 5.4 Persistence normalization

- If an incoming event does **not** include a `persistence` field, it must be treated as `Permanent`.

- Implementations may normalize this at ingestion time, but normalization is not required as long as behavior is correct.

This rule applies uniformly to events received via WebSocket, REST, or command reconciliation.

---

## 5.5 Storage model

Each Event Cache entry must be attributable to the **current session** and include at least:

- `persistence: 'Permanent' | 'Stateful' | 'Anticipated'`

- `event: object`

- `receivedAt: number`

Additional required fields by class:

### Anticipated events

- `commandId: string`

### Permanent events

- `eventId: string`

- `position: bigint`

- `streamId: string`

- `revision: number`

### Optional attribution

- `cacheKey?: string`

- `collectionName?: string`

Attribution to cache keys or collections is used only for **cleanup and eviction** and must not be required for correctness.

---

## 5.6 Retention and deletion rules (hard requirements)

### 5.6.1 Permanent events

Permanent events must be deleted from the Event Cache as soon as:

- they have been successfully applied to the Read Model Store, and

- they are no longer needed for gap detection or repair

A short grace window may be used to detect late or out-of-order arrivals.

Recommended maximum grace window:

- **30 seconds**

---

### 5.6.2 Anticipated events

Anticipated events must be deleted when:

- the associated command succeeds and authoritative state is known, or

- the command is cancelled or fails irrecoverably, or

- a **session reset** occurs due to user identity change

Anticipated events must not survive a session wipe.

---

### 5.6.3 Stateful events

Stateful events may be deleted after:

- successful application, or

- scheduling of an authoritative refetch

They must not accumulate unboundedly.

---

## 5.7 Gap detection and repair coordination

The Event Cache cooperates with the Sync Manager to support gap repair:

- Permanent events are de-duplicated by `event.id`

- Buffered permanent events must not be applied until:
  - all earlier revisions for the same stream are available

- When a gap is detected:
  - the Sync Manager is responsible for fetching missing events

  - fetched events are written back into the Event Cache

The Event Cache itself does not initiate network activity.

---

## 5.8 Interaction with cache eviction

On `CacheKeyEvicted(key)`:

- All Event Cache entries **attributable to that key** must be deleted

- This includes:
  - buffered permanent events

  - stateful events

  - anticipated events with that attribution

Events without cache key attribution (e.g., anticipated events affecting unloaded data) must be retained until normal deletion rules apply.

---

## 5.9 Session reset handling

When a session user mismatch occurs:

- the Event Cache must be **fully cleared**

- all buffered and anticipated events are discarded

- no event from a previous user may survive the reset

This wipe is unconditional and independent of eviction policy.

---

## 5.10 Failure and recovery guarantees

The Event Cache must ensure:

- duplicate events are never applied twice

- buffered events are not lost before they are safe to delete

- partial crashes or reloads do not corrupt gap tracking

- resumption after offline periods preserves correctness

The Event Cache may be aggressively compacted as long as these guarantees are upheld.

---
