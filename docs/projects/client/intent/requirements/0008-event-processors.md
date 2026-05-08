# 8\. Event Processors (Per-Collection Reducers with Local Lookups)

## 8.1 Purpose

Event Processors are responsible for **transforming snapshots and events into read model records** stored in the Read Model Store.

They are the only components allowed to:

- interpret domain events

- mutate read model records

- maintain link tables and derived collections

Event Processors must support **authoritative updates** from the server and **optimistic updates** from anticipated events, including **creation of new records**.

---

## 8.2 Responsibilities

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

## 8.3 Processor interface

A processor is a function:

```ts
(event: TEvent, state: TModel | undefined, context: ProcessorContext) => ProcessorReturn<TModel>
```

`state` is the current effective state of the affected record (`undefined` if no record exists yet — typically when the event creates a new entity).

`context: ProcessorContext` carries:

- `persistence: 'Permanent' | 'Stateful' | 'Anticipated'` — discriminates server-baseline events from optimistic / stateful events

- `commandId?: string` — set for Anticipated events

- `revision?: bigint`, `position?: bigint` — set for Permanent events

- `streamId: string`, `eventId: string` — always present

`ProcessorReturn<TModel>` is:

- `ProcessorResult<TModel>` — a single read-model update

- `ProcessorResult<TModel>[]` — multiple updates (e.g., when one event affects several collections or records)

- `InvalidateSignal` (`{ invalidate: true }`) — the processor cannot apply the event; signal a refetch (see [§5.7](0005-sync-manager.md#57-stateful-event-handling))

- `undefined` — no-op (event ignored)

`ProcessorResult<TModel>` carries `{ collection, id, update, isServerUpdate }`:

- `collection: string` — target collection. A single processor invocation can return multiple `ProcessorResult`s (via the array return form) targeting different collections — a single event may legitimately touch several collections.

- `id: EntityId` — entity ID being updated

- `update: UpdateOperation<TModel>` — `{ type: 'set', data }`, `{ type: 'merge', data: Partial<TModel> }`, or `{ type: 'delete' }` (see [§7.5](0007-read-model-store.md#75-deletes-and-update-operations))

- `isServerUpdate: boolean` — distinguishes baseline updates (from server snapshots or permanent events) from optimistic updates (from anticipated events)

Processors are registered via `ProcessorRegistration { eventTypes, processor, persistenceTypes? }`:

- `eventTypes: string | string[]` — event type(s) this processor handles

- `persistenceTypes?: EventPersistence[]` — optional filter limiting the processor to specific persistence types (e.g., only `'Permanent'`)

---

## 8.4 Creation semantics (authoritative and anticipated)

### 8.4.1 Authoritative creation

When a permanent server event represents creation of a new aggregate:

- the processor must be able to:
  - create a new read model record from `record === null`

  - initialize server baseline state

- subsequent permanent events are applied normally

---

### 8.4.2 Anticipated creation

When an anticipated event represents creation of a new aggregate, the processor returns a `ProcessorResult` with:

- `update: { type: 'set', data: T }` — the optimistic entity record

- `isServerUpdate: false`

The Read Model Store handles baseline/overlay storage per [§7.4](0007-read-model-store.md#74-server-baseline-vs-effective-overlay-semantics) — for a locally-created entity (no server confirmation yet), `serverData` is null and `effectiveData` carries the optimistic entity. `_clientMetadata` is populated from the command's `creates.idStrategy === 'temporary'` so the UI can maintain stable references through subsequent reconciliation (see [§7.3](0007-read-model-store.md#73-data-model-requirements) and [0014 §24.4](0014-entity-ref.md#144-id-strategy)).

Anticipated-created records:

- may exist before any server snapshot or permanent event

- must remain stable across reloads while the command is pending

This is the primary reason for `dependsOn` in the Command Queue: dependent commands may rely on the existence of optimistic records created by earlier commands. The original intent required consumers to declare `dependsOn` manually for these entity references; implementation has since refined this into auto-wiring from `EntityRef.commandId` values in command data (see [§4.6.1](0004-command-queue.md#461-dependencies) and [0014 §14.6.1](0014-entity-ref.md#1461-automatic-dependson)) — the boilerplate is no longer required for entity references. Explicit `dependsOn` declarations remain available for non-EntityRef ordering constraints.

---

## 8.5 Ordering and application rules

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

## 8.6 Interaction with dependencies (`dependsOn`)

- `dependsOn` ordering is enforced by the Command Queue. The library auto-wires `dependsOn` from `EntityRef.commandId` values in command data (see [§4.6.1](0004-command-queue.md#461-dependencies)); explicit consumer declarations remain available for non-EntityRef ordering constraints.

- Event Processors may assume:
  - anticipated events arrive in dependency-safe order

  - a dependent command's anticipated events will not be applied before its prerequisites

- Processors must **not** perform dependency resolution themselves.

This allows processors to safely assume that optimistic records required by later commands already exist.

---

## 8.7 Stateful event handling

Stateful events:

- may be applied immediately on arrival

- may reference records that do not exist locally

If a processor cannot apply a stateful event due to missing context or ambiguity, it must:

- return `{ invalidate: true }`

- allow the Sync Manager to schedule a refetch

Stateful application must never corrupt effective state.

---

## 8.8 Atomicity and consistency

Processors must preserve consistency across:

- primary records

- link tables

- derived collections

Requirements:

- updates must be atomic where supported by the storage layer

- partial application must not leave the Read Model Store in an inconsistent state

- processors must be safe to re-run after crashes or reloads

---

## 8.9 Interaction with cache eviction

- Processors must tolerate missing baselines due to eviction.

- If a record has been evicted:
  - subsequent events may recreate it via snapshot, permanent event, or anticipated creation

- Eviction must never cause processors to throw or corrupt state.

---

## 8.10 Session reset handling

On session reset (user identity change):

- all read model data is wiped

- processors restart from a clean state

- no prior optimistic or authoritative data may be reused

---

## 8.11 Failure and recovery guarantees

Event Processors must ensure:

- deterministic outcomes given the same inputs

- safe resumption after crashes or reloads

- no duplicate application of events

- no corruption from partially applied updates

Processor implementations may choose batching or checkpointing strategies internally, but correctness must always be preserved.

---
