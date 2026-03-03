# 11\. Open Ambiguities and Deferred Decisions

The remaining items are intentionally deferred, either because they depend on server-side capabilities or because multiple valid implementations are acceptable.

---

## 11.1 Command reconciliation contract (server → client)

**Status:** Deferred, server-dependent

The Command Queue requires a deterministic way to associate server-side effects with a client-issued command.

Accepted future options include one or more of:

- server response includes an explicit list of produced event IDs

- server response includes the produced events inline

- server guarantees propagation of `commandId` onto all produced events

Until this is finalized:

- reconciliation may fall back to refetching authoritative read models

- anticipated events must be discarded once authoritative state is known

This is a server API contract decision, not a client-side architectural ambiguity.

---

## 11.2 Permanent event gap repair APIs

**Status:** Resolved conceptually, endpoint details deferred

Permanent gap repair is **collection-specific** and **aggregate-specific**.

There is no single global “fetch all missing events” endpoint.
Each collection configuration must provide sufficient information to:

- detect missing revisions or positions

- fetch missing events for the affected aggregate or stream

The exact REST shapes and parameters are deferred to per-service configuration but the behavior is fully specified.

---

## 11.3 Stateful refetch batching strategy

**Status:** Deferred, implementation choice

For stateful events that require refetch:

- refetch must be debounced per `(cacheKey, collection)`

- the Sync Manager may use:
  - `lastUpdated >= timestamp`

  - cursor-based batching

  - or “fetch latest snapshot” semantics

The exact batching and cursor strategy may vary per service and does not affect correctness as long as stampede prevention and eventual consistency are preserved.

---

## 11.4 Processor scheduling and checkpointing strategy

**Status:** Deferred, implementation choice

Event processors may be implemented using:

- strict serialization per `(collection, cacheKey)`

- batched processing with checkpoints

- transactional DB operations or equivalent mechanisms

The only hard requirements are:

- deterministic results

- resumability after crashes or reloads

- no partial application leading to corrupted effective state

---

## 11.5 Persistent key eviction prioritization under pressure

**Status:** Deferred, tuning decision

When multiple persistent cache keys are eligible for eviction:

- eviction order beyond LRU + frozen semantics is implementation-defined

- implementations may prefer:
  - non-active keys

  - smaller estimated size

  - older access timestamps

This is a tuning concern and does not affect the correctness contract.

---

## 11.6 Excessive window count thresholds (multi-tab mode only)

**Status:** Deferred, configuration decision

In multi-tab mode, the threshold at which:

- warnings are surfaced to the user

- or operations are blocked

is intentionally configurable and environment-dependent.

The spec defines required **failure modes**, not exact limits.

**Note:** In single-tab modes, this is not applicable — only one tab is permitted.

---

## 11.7 Non-browser environments

**Status:** Explicitly out of scope

This specification assumes:

- a browser environment

- OPFS availability (for offline persistence via SQLite WASM)

- SharedWorker, Dedicated Worker, or main-thread execution

Support for:

- Node.js

- React Native

- non-browser runtimes

is out of scope for this version.

---

## 11.8 Removed ambiguities

The following items are **no longer ambiguous** and are intentionally omitted:

- cache key eviction semantics

- ephemeral vs persistent data handling

- session and user identity boundaries

- optimistic creation via anticipated events

- UI update model (query latest snapshot, events as invalidation only)

- storage worker restart resilience (multi-tab mode)

- window lifecycle and hold cleanup (multi-tab mode)

- single-tab enforcement (single-tab modes)

---

## 11.9 Guiding principle for future extensions

Any future extensions to this specification must preserve:

- single-session isolation

- eviction safety

- offline-first correctness

- deterministic recovery

- pull-based UI data access

If a proposed feature violates one of these principles, it must be redesigned or explicitly versioned.

---
