# 7\. Event Processors (Per-Collection Reducers with Local Lookups)

## 7.1 Purpose

Event Processors are responsible for **transforming snapshots and events into read model records** stored in the Read Model Store.

They are the only components allowed to:

- interpret domain events

- mutate read model records

- maintain link tables and derived collections

Event Processors must support **authoritative updates** from the server and **optimistic updates** from anticipated events, including **creation of new records**.

---

## 7.2 Responsibilities

Event Processors are responsible for:

- Consuming inputs:
  - server-provided read model snapshots

  - permanent server events (ordered)

  - anticipated events (optimistic)

  - stateful events (best-effort)

- Producing outputs:
  - upserted or deleted read model records

  - link-table updates for many-to-many relationships

  - derived or aggregated collection updates

- Performing **local-only** asynchronous lookups (database reads)

- Signaling when an event cannot be safely applied and requires refetch

Event Processors must **never** perform network I/O.

---

## 7.3 Processor interface (conceptual)

Each collection defines a processor with the following reducers:

- `reduceServer(record | null, permanentEvent) -> Result`

- `reduceAnticipated(record | null, anticipatedEvent) -> Result`

- `reduceStateful(record | null, statefulEvent) -> Result | { invalidate: true }`

Where `record` may be `null` when:

- the record does not yet exist

- the event represents creation of a new entity

`Result` must be one of:

- `{ op: 'upsert', modified: boolean, value: T }`

- `{ op: 'delete' }`

- `{ op: 'none' }`

Processors may also return:

- `{ invalidate: true }`  
  to signal that authoritative refetch is required

---

## 7.4 Creation semantics (authoritative and anticipated)

### 7.4.1 Authoritative creation

When a permanent server event represents creation of a new aggregate:

- the processor must be able to:
  - create a new read model record from `record === null`

  - initialize server baseline state

- subsequent permanent events are applied normally

---

### 7.4.2 Anticipated creation

When an anticipated event represents creation of a new aggregate:

- the processor must be able to:
  - create a **new cached record** from `record === null`

  - mark it as optimistic by:
    - storing the authoritative baseline in `server` when available

    - computing effective state in `data`

- anticipated-created records:
  - may exist before any server snapshot or permanent event

  - must remain stable across reloads while the command is pending

This is the primary reason for `dependsOn` in the Command Queue:  
dependent commands may rely on the existence of optimistic records created by earlier commands.

---

## 7.5 Ordering and application rules

For a given record or aggregate stream, processors must apply inputs in the following order:

1.  Server snapshot baseline (if present)

2.  Permanent events (strict revision/position order)

3.  Anticipated events (deterministic command order)

Rules:

- Permanent events **must not** be applied out of order.

- If a permanent event arrives with a revision gap:
  - the processor must refuse application

  - return an invalidation or gap signal

- Anticipated events:
  - may be applied immediately

  - must be applied in a stable, deterministic order

  - may depend on prior anticipated creations

---

## 7.6 Interaction with dependencies (`dependsOn`)

- `dependsOn` ordering is enforced by the Command Queue.

- Event Processors may assume:
  - anticipated events arrive in dependency-safe order

  - a dependent command’s anticipated events will not be applied before its prerequisites

- Processors must **not** perform dependency resolution themselves.

This allows processors to safely assume that optimistic records required by later commands already exist.

---

## 7.7 Stateful event handling

Stateful events:

- may be applied immediately on arrival

- may reference records that do not exist locally

If a processor cannot apply a stateful event due to missing context or ambiguity, it must:

- return `{ invalidate: true }`

- allow the Sync Manager to schedule a refetch

Stateful application must never corrupt effective state.

---

## 7.8 Atomicity and consistency

Processors must preserve consistency across:

- primary records

- link tables

- derived collections

Requirements:

- updates must be atomic where supported by the storage layer

- partial application must not leave the Read Model Store in an inconsistent state

- processors must be safe to re-run after crashes or reloads

---

## 7.9 Interaction with cache eviction

- Processors must tolerate missing baselines due to eviction.

- If a record has been evicted:
  - subsequent events may recreate it via snapshot, permanent event, or anticipated creation

- Eviction must never cause processors to throw or corrupt state.

---

## 7.10 Session reset handling

On session reset (user identity change):

- all read model data is wiped

- processors restart from a clean state

- no prior optimistic or authoritative data may be reused

---

## 7.11 Failure and recovery guarantees

Event Processors must ensure:

- deterministic outcomes given the same inputs

- safe resumption after crashes or reloads

- no duplicate application of events

- no corruption from partially applied updates

Processor implementations may choose batching or checkpointing strategies internally, but correctness must always be preserved.

---
