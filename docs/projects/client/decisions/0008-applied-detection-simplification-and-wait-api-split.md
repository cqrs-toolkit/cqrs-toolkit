# ADR 0008 (client) — Simplify `'applied'` coverage detection; split command-wait API into `waitForSucceeded` / `waitForApplied`

**Status:** Accepted 2026-04-27

**Supersedes [ADR 0007 (client)](0007-applied-status-split.md).**
The elaborate `pendingAggregateCoverage` design (per-row column, multi-aggregate map, rule 1/2a/2b matrix, `'updated'` shrink branch) introduced in `707b14b` (2026-04-22) was replaced five days later in `84dc12f` (2026-04-27) with a simpler primary-aggregate revision check.
[ADR 0007](0007-applied-status-split.md) documents the design that shipped at `707b14b`; this ADR documents the design that replaced it and stands today.

## Context

[ADR 0007](0007-applied-status-split.md) introduced the `'applied'` status to relocate optimistic-overlay cleanup off the `'succeeded'` transition.
The detection that a command had reached `'applied'` was framed as a coverage problem: each command at `'succeeded'` carried a `pendingAggregateCoverage?: string` blob — either a `'events'` marker (wait for one of the response's events to drain) or a `Record<streamId, stringifiedBigInt>` (wait for `knownRevisions[streamId] >= expected` per aggregate, with a cache-key-eviction slip).
When the per-aggregate map shrank but didn't empty, the command transitioned to a synthetic `'updated'` (re-persisted with the smaller map; status stayed `'succeeded'`).

That model assumed commands routinely touch multiple aggregates whose revisions advance independently, and that distinguishing partial coverage from full coverage was load-bearing.
In practice neither assumption held:

- The vast majority of commands have a clean primary aggregate (the `id` in their response).
  Cross-aggregate effects exist but are rarely on the critical path of the optimistic overlay's lifetime.
- The cache-key scope already absorbs the dependency on out-of-scope streams — when a command's cache key is evicted, all its in-flight effects implicitly stop mattering.

A second pressure was on the consumer-facing wait API.
`enqueueAndWait` previously resolved on a single `'completion'` notion that bundled "server acknowledgement" and "effects reflected in `serverData`."
With `'applied'` as a real status, consumers needed to distinguish the two: a fast-confirmation UI wants `'succeeded'`; a "data has caught up" UI wants `'applied'`.

## Decision

### Coverage detection simplified to a primary-aggregate revision check

The `'succeeded'` → `'applied'` transition is decided by `SyncManager.evaluateCoverageForBatch` using a single rule per command:

1. If the command's cache key is no longer in `CacheManager` → `applied` (cache-key-evicted slip; the dependency on its streams is absorbed by scope eviction).
2. Else read `id` and `nextExpectedRevision` from `command.serverResponse`.
   If either is missing, stay `'succeeded'`.
3. Else compute `primaryStreamId = registration.aggregate.getStreamId(id)` and check `knownRevisions[primaryStreamId] >= expected`.
   If yes → `applied`; if no → stay `'succeeded'`.

`evaluateCoverageForBatch` returns `{ applied: CommandRecord[] }` only.
There is no `updated` set, no per-aggregate map shrink/rewrite, no `'events'` marker.

`CommandQueue` mirrors the same primary-aggregate check at success time so a command whose target revision is _already present_ in `knownRevisions` doesn't get stuck at `'succeeded'`; the success path can transition directly to `'applied'` via `batchUpdateSyncStatus({ applied: [command] })`.

### Removed surface

- `pendingAggregateCoverage?: string` field is removed from `CommandRecord`, the SQLite schema, the storage record type, and round-trip tests.
- `collectIdMappingCandidates` returns `{ candidates, uncoveredStreams }` only.
  The `expectedRevisionsByStream` field is gone.
- `batchUpdateSyncStatus(params)` accepts only `{ applied?: Iterable<CommandRecord> }`.
  No `updated` set; the `'updated'` shrink branch is gone.
- The per-batch `commandIdsWithDrainedEvents` tracking is removed.

### Pre-release migration

Per the project's pre-release posture (see `/docs/decisions/0001-pre-release-no-back-compat.md`), the schema migration drops pre-existing `'succeeded'` records rather than backfilling coverage data — there's no safe baseline for in-flight commands at upgrade time.

### Wait API split

`waitForCompletion` is replaced by two explicit waiters on `CommandQueue`:

- `waitForSucceeded(commandId)` — resolves on `'succeeded'` (server acknowledgement).
- `waitForApplied(commandId)` — resolves on `'applied'` (effects reflected in `serverData`).

`enqueueAndWait` defaults to `'applied'`; callers can opt back into the earlier resolve with `params.waitFor: 'succeeded'`.

`CqrsClient.submit` waits for `'applied'` when online and returns the cached server response when offline (or when a prior `'succeeded'` record is observed without a live drain — the network-disconnected case where waiting for applied would never resolve).

`waitForTerminal` is extracted as a shared helper used by both `CommandQueue` and `CommandQueueProxy`, collapsing previously-triplicated race/timeout/result scaffolding.
Events act as signals only; results are derived from authoritative state via `getCommand`.

### CollectionSignal carries originating command IDs

`CollectionSignal.updated.commandIds` is added — the set of command ids whose effects produced the batch, propagated from the existing `readmodel:updated` event.
Empty for server-driven updates (seed, gap repair, propagated events with no local origin).
Both `QueryManager` and `QueryManagerProxy` plumb the field through.

This pairs with the wait-API split: a consumer holding a command id can correlate query-side updates with their own commands, enabling "still applying" UI states without polling.

### `EventProcessorRunner` deleted

[ADR 0007](0007-applied-status-split.md)'s Notes (line 135 in the superseded body) said `EventProcessorRunner`'s skeleton was retained intentionally despite most of its code being stripped, on the speculation that the pipeline might recoalesce around it.
That speculation didn't pan out — by 2026-04-27 the class had been dead since the 6-phase reconcile pipeline, and the anticipated-event path no longer routes through it.
The class, its public re-export, the `ProcessEventResult` export, and the bootstrap construction are all removed.
`EventProcessor.test.ts` is renamed `EventProcessorRegistry.test.ts` to reflect what's actually tested.
Comments in `GapRepairCoordinator`, `write-queue/operations`, and `reconcilePendingCommands` that pointed at `EventProcessorRunner` are updated to point at the reconcile pipeline.

## Consequences

### Implementation impact

- `SyncManager.evaluateCoverageForBatch` simplified to a primary-aggregate revision check (returns `{ applied: CommandRecord[] }` only).
- `CommandQueue` success-time mirror of the primary-aggregate check to allow direct `'succeeded'` → `'applied'` transitions when the target revision is already present in `knownRevisions`.
- Removal of `pendingAggregateCoverage?: string` field from `CommandRecord`, the SQLite schema, the storage record type, and round-trip tests.
- `collectIdMappingCandidates` return shape simplified to `{ candidates, uncoveredStreams }` (removed `expectedRevisionsByStream`).
- `batchUpdateSyncStatus(params)` accepts only `{ applied?: Iterable<CommandRecord> }` (no `updated` set, no `'updated'` shrink branch).
- Removal of per-batch `commandIdsWithDrainedEvents` tracking.
- Replacement of `waitForCompletion` with two explicit waiters: `waitForSucceeded(commandId)` and `waitForApplied(commandId)`.
- `enqueueAndWait` default changed to `'applied'`; opt-back-in via `params.waitFor: 'succeeded'`.
- `CqrsClient.submit` waits for `'applied'` when online; offline / disconnected-with-prior-`'succeeded'` returns cached server response.
- `waitForTerminal` shared helper extracted; used by both `CommandQueue` and `CommandQueueProxy`. Events act as signals only; results derived from authoritative state via `getCommand`.
- `CollectionSignal.updated.commandIds` field added; propagation through `QueryManager` and `QueryManagerProxy`.
- `EventProcessorRunner` class, public re-export, `ProcessEventResult` export, and bootstrap construction removed.
- `EventProcessor.test.ts` renamed to `EventProcessorRegistry.test.ts`.
- Comments in `GapRepairCoordinator`, `write-queue/operations`, and `reconcilePendingCommands` updated to point at the reconcile pipeline (away from `EventProcessorRunner`).
- Pre-release schema migration: drop pre-existing `'succeeded'` records.

### Operational implications

#### Gains

- Simpler coverage model — one rule per command instead of three; no per-row coverage payload to serialize, parse, or migrate.
- The `'applied'` transition is a batch-local decision against `knownRevisions` and `CacheManager.existsSync`; no historical state on the row is needed.

#### Costs

- Primary-aggregate-only coverage means commands whose response touches multiple aggregates are marked `'applied'` when only the primary stream's revision has caught up.
  Secondary-aggregate effects may not be reflected when the optimistic overlay is cleaned up.
  In practice this is acceptable because the cache-key-eviction slip absorbs out-of-scope advances, and current command shapes have a clean primary aggregate.
  If a future workload makes multi-aggregate coverage load-bearing, the rejected design from [ADR 0007](0007-applied-status-split.md) (per-aggregate map, `'updated'` shrink branch) is the documented starting point for revival.
- The cache-key-evicted slip is a soft cover.
  If a cache key is evicted _during_ the brief `'succeeded'` → `'applied'` window, the command is marked applied without revision confirmation.
  Deliberate: cache-key scope already absorbed the dependency.

### Coding implications

#### Gains

- Consumers can pick the wait semantics that match their UI: fast confirmation (`succeeded`) or data-reflected (`applied`).
- `CollectionSignal.updated.commandIds` lets consumers render command-level "still applying" UI without polling status.
- `EventProcessorRunner` deletion removes a vestigial class that future contributors would have to reason about.

## Notes

The `'events'` marker (rule 1 in [ADR 0007](0007-applied-status-split.md)) is gone.
There is no longer an explicit "wait for one of the response's events to drain" mechanism — coverage is purely revision-based.
This is sound because the response's events, when they drain, advance `knownRevisions[primaryStreamId]` past `nextExpectedRevision` anyway; the dedicated marker was redundant.

`pendingAggregateCoverage`'s removal is captured here rather than as cleanup-of-record because the rejected design is a real artifact future contributors might propose to revive (e.g., for multi-tenant or multi-aggregate workloads).
This ADR is the "we tried it, it was unnecessary at our scale, here's why" record.

## Related

- [ADR 0007 (client)](0007-applied-status-split.md) — superseded.
  Documents the elaborate `pendingAggregateCoverage` design that shipped briefly in `707b14b` and was simplified five days later.
- [ADR 0001 (client)](0001-anticipated-event-submit-vs-pipeline.md) — Anticipated event application: submit-time and pipeline-time are separate concerns.
  Still load-bearing — the simplification here doesn't touch the submit-time application.
- [ADR 0005 (client)](0005-reconcile-entry-point-split.md) — Reconcile entry-point split.
  `evaluateCoverageForBatch` is invoked from inside `reconcileAndPersist`, which both `reconcileFromWsEvents` and `onApplyRecords` delegate to.
- [ADR 0006 (client)](0006-command-store.md) — `CommandStore`.
  `batchUpdateSyncStatus` is the canonical synchronous batch-update consumer; the simplified `{ applied? }` signature matches the simpler coverage model.
- [ADR 0003 (client)](0003-server-data-pipeline-rewrite.md) — Server data pipeline rewrite.
  The umbrella decision-of-record for the rewrite that this ADR is the closing slice of.
  The `EventProcessorRunner` deletion above is the closing of that rewrite, not a one-off cleanup; [ADR 0003](0003-server-data-pipeline-rewrite.md) is the retained-skeleton hedge being retired.
