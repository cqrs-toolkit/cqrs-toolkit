# ADR 0007 (client) — `'applied'` status split: relocate anticipated-event cleanup off the success transition

**Superseded by [ADR 0008 (client)](0008-applied-detection-simplification-and-wait-api-split.md) (2026-04-27)** — the `pendingAggregateCoverage` design described below was simplified to a primary-aggregate revision check, and the consumer-facing wait API was split into `waitForSucceeded` / `waitForApplied`.
This ADR remains as the decision-of-record for the design that shipped in commit `707b14b` (2026-04-22); [ADR 0008](0008-applied-detection-simplification-and-wait-api-split.md) is authoritative for current code.

**Status:** Accepted 2026-04-22

## Context

Before this change, `AnticipatedEventHandler.cleanup(commandId, 'succeeded')` ran synchronously from `CommandQueue.updateCommandStatus` at the `'succeeded'` transition.
For each tracked overlay row it called `readModelStore.clearLocalChanges`, and for creates (no server baseline) `clearLocalChanges` deletes the row outright.

Server response events flow through `SyncManager.handleCommandResponseEvents`, which pushes onto `pendingWsEvents` and schedules a `reconcile-ws-events` write-queue op — fire-and-forget by contract.
The cleanup thus ran *first* (wiping the optimistic overlay), and the drain wrote server data *after*.
Between those two points the entity was visibly gone from the UI, especially on creates.

The same gap existed on the WS-only path.
This shape was the cause of multiple broken demo e2e tests for create-then-assert flows.

The fix had to preserve three pre-existing invariants:

1. **`waitForSucceeded` latency** — command promises must still resolve on `'succeeded'`.
2. **Submit-time anticipated event application stays** — `AnticipatedEventHandler.onApplyAnticipatedOp` must remain (per [ADR 0001 (client)](0001-anticipated-event-submit-vs-pipeline.md); the previous fold-attempt cost a day of wasted work).
3. **`anticipatedUpdates` ownership** stays on `AnticipatedEventHandler`.

A second concern was *when* cleanup of the optimistic overlay should happen.
The natural answer — "after the server's effects are reflected in `serverData`" — is not detectable at the `'succeeded'` transition; it depends on subsequent WS events arriving and being applied.
The pipeline is the only component that knows when that has happened.

## Decision

**Add `'applied'` as a post-terminal status.**
Commands transition `pending → … → succeeded → applied`.
`'succeeded'` remains the user-facing terminal status (`isTerminalStatus` includes it; `waitForSucceeded` resolves on it).
`'applied'` is post-terminal — entered only after the pipeline observes that the command's effects are reflected in `serverData`, signalling that the optimistic overlay can be safely cleaned up.

`'applied'` is added to `TerminalCommandStatus` and `isTerminalStatus` so consumer-side guards (`cancelCommand`, `waitForSucceeded` event filter, dependency `blockedBy` checks, cascade-cancel, proxy mirrors) treat applied commands as done.
`updateCommandStatus` now `assert`s `newStatus !== 'applied'` — the pipeline uses `batchUpdateSyncStatus` directly; applied must never reach the status-transition side-effect branch.

### Cleanup is split into three methods on `IAnticipatedEventHandler`

- `cleanupOnSucceeded(commandId)` — EventCache prune only. Does **not** touch `anticipatedUpdates`; does **not** call `clearLocalChanges`. The overlay survives until the applied transition.
- `cleanupOnAppliedBatch(commandIds)` — for each id: `eventCache.deleteAnticipatedEvents(id)` + `anticipatedUpdates.delete(id)`. (Internal loop; `TODO(batch)` documents a future per-batch storage primitive.)
- `cleanupOnFailure(commandId)` — preserves the original `cleanup` semantics: EventCache prune + `anticipatedUpdates.delete` + `readModelStore.clearLocalChanges` for every tracked entry, reverting the optimistic overlay.

The old `cleanup(commandId, terminalStatus)` is removed.

### `pendingAggregateCoverage` on `CommandRecord`

A new optional `pendingAggregateCoverage?: string` column (nullable `TEXT` in SQLite) carries the success-time hint about *what coverage is needed* before the command can be marked applied.
Two encodings:

- `JSON.stringify('events')` — the "rule 1 marker." Set when the command's response carried events; the pipeline waits for one of those events (matched by `metadata.commandId`) to be drained, then transitions to `'applied'`.
- `JSON.stringify(Record<streamId, stringifiedBigInt>)` — the per-aggregate map. Set when the response had no events; the pipeline marks each entry covered when post-batch `knownRevisions[streamId] >= expectedRevision` (rule 2a) or when the command's cache key is evicted (rule 2b — cache-key scope absorbs the implication). When the map empties, the command transitions; when the map shrinks but is non-empty, the command is `updated` (re-persisted with the smaller map; status stays `'succeeded'`).

Streams with unparsable or unresolved `nextExpectedRevision` are omitted from the Record at success-time, and an invalidation event fires via the bus for those streams (and for streams from the command's anticipated events when the response is event-less).

### Success-path behavior (in `CommandQueue.processCommand`)

At the `'succeeded'` transition, inline:

1. Call the extended `collectIdMappingCandidates` which now returns `{ candidates, expectedRevisionsByStream, uncoveredStreams }`.
2. Build `pendingAggregateCoverage` per the encoding above.
3. Write `{ status: 'succeeded', serverResponse, pendingAggregateCoverage, updatedAt }` via the existing direct `storage.updateCommand` path.
4. Apply ID rewrites as a **local-changes overlay** (never `serverData`) via `ReadModelStore.migrateEntityIds(...)`.
   `migrateEntityIds` handles the full tempId→serverId row migration cohesively: load, patch top-level `id` field, preserve `_clientMetadata` / `cacheKeys` / `revision` / `position`, write new row, delete old. When `serverData === null`, the new row is written with `hasLocalChanges: false` so the first `setServerData` call accepts the baseline cleanly.
5. Call `cleanupOnSucceeded(commandId)` — EventCache prune only.
6. Fire `sync:invalidate-requested` events on the bus for uncovered streams and event-less responses (deduped by streamId).

### Applied transition (in `SyncManager.reconcileAndPersist`)

Pipeline owns the transition.
Entirely inside the existing `reconcile-ws-events` write-queue op.

- Command-status filter widened to include `'succeeded'` so just-succeeded commands are loaded into the batch alongside `pending`/`blocked`/`sending`.
- A new private `evaluateCoverageForBatch` method implements rules 1 and 2 against the batch event metadata, post-batch `knownRevisions`, and `CacheManager.existsSync` for cache-key state.
- At end of `reconcileAndPersist` (after existing Phase 6 writes):
  ```ts
  await commandQueue.batchUpdateSyncStatus({ applied, updated })
  await anticipatedEventHandler.cleanupOnAppliedBatch(appliedIds)
  ```
- `CommandQueue.batchUpdateSyncStatus({ applied?, updated? })` issues a single `storage.updateCommands` call covering both sets and emits `'status-changed'` events for applied only. Doc comment enforces: no write-queue interaction, no re-read from storage.
- Regeneration composition skips commands in the applied set when populating `anticipatedUpdates`.

### Invalidation via event bus (not via injected hook)

An earlier design introduced `IAggregateInvalidationHook` + `AggregateInvalidationHook`.
After review, the hook was collapsed:

- `InvalidationScheduler` (already private inside `SyncManager`) gains a public `invalidateAggregate({ streamId, cacheKey, commandId, reason })` method owning the streamId → collection resolution + debounced schedule.
- `LibraryEventType` / `LibraryEventData` add `sync:invalidate-requested` (slotted with `sync:refetch-scheduled` / `sync:refetch-executed`).
- `CommandQueue` emits the event instead of holding any reference to a hook or scheduler.
- `SyncManager.start()` subscribes (with the existing `takeUntil(destroy$)` lifecycle pattern) and dispatches to its private `invalidationScheduler`.

This avoided cross-component construction-order coupling and kept `invalidationScheduler` private to `SyncManager`.

### Read-model write contract

Phase 3 of `reconcileFromWsEvents` no longer writes to storage.
Processor results are staged into `DeferredApplication[]` on `ServerStateChangeResult.pendingApplications`.
A new `ReadModelStore.commit(mutations, preloaded?)` is the single entry point for all pipeline read-model writes — a `ReadModelMutation` discriminated union (`setServer` / `mergeServer` / `setLocal` / `applyLocal` / `delete` / `migrateId` / `setClientMetadata`), folded per row through pure compute helpers, flushed via bulk `saveReadModels` + `migrateReadModelIds` plus per-row `deleteReadModel` / `addCacheKeysToReadModel` (with `TODO(batch)` markers for future bulk primitives).

`reconcileAndPersist` builds a single mutation list (migrations → deferred Phase 3 writes → Phase 5 client overlays → `_clientMetadata` stamps) and issues one `commit(mutations)` after the command/anticipated-event/mapping writes.
This formalizes the "all reads up front, all writes at the end" pipeline contract.

### Helper

`isConfirmedStatus(s): s is 'succeeded' | 'applied'` for switches that should treat both as success.
Used in `toCompletionResult`, `eventToCompletionResult`, and submit-idempotency in `createCqrsClient`.

## Consequences

**Easier:**
- No window of overlay absence between `'succeeded'` and the next pipeline drain.
  The optimistic overlay survives until the pipeline confirms server effects landed; create-then-assert flows no longer flicker.
- The pipeline owns the applied transition — a single decision point with batch-local visibility into events, revisions, and cache-key state.
- Invalidation is decoupled via the event bus.
  `CommandQueue` has zero references to `InvalidationScheduler` / `SyncManager` / collections-for-invalidation purposes. No bootstrap wiring, no construction-order coupling.
- The "all reads up front, all writes at the end" contract for the reconcile pipeline is now structural (every write goes through `ReadModelStore.commit`).
- A future `TimedAggregateInvalidationHook` (wait-for-WS-then-invalidate) becomes a subscriber-side change inside `InvalidationScheduler.invalidateAggregate`, not a cross-component interface swap.

**Harder:**
- `'applied'` is added to `TerminalCommandStatus` and `isTerminalStatus` because consumer-facing guards (cascade-cancel, dependency `blockedBy`, etc.) need to treat applied commands as done. This means *seven* call-sites that previously checked `isTerminalStatus` are now exercised against an additional status; auditing each was required (resolved in Step 9).
- The `pendingAggregateCoverage` column adds a per-row payload during the brief succeeded → applied window. Pre-release, the migration deletes pre-existing `'succeeded'` records (no safe backfill of coverage for in-flight commands at upgrade time).
- Two encodings for `pendingAggregateCoverage` (string `'events'` marker vs `Record<streamId, bigint-string>`) increase the serialization complexity. Discrimination at parse time is `typeof === 'string' && value === 'events'` vs object — straightforward but requires a defensive parser.
- Rule 2b ("cache key absent → whole map covered") is a soft cover. If a cache key is evicted *during* the brief succeeded → applied window, all coverage entries are absorbed even if revisions never advance. This is a deliberate design choice: cache-key scope already absorbed the dependency on those streams; chasing absent data is wasted work.
- `cleanupOnAppliedBatch` loops internally with a `TODO(batch)` marker; a real batch primitive on `EventCache` is deferred.

## Notes

The "out of scope / deferred" items in the source plan are still deferred:

- `extractRevisionFromResponse` migration (predates the new config; out of scope).
- Moving CommandQueue command processing into a write-queue op (separate investigation).
- Proper batched implementation inside `cleanupOnAppliedBatch`.
- Timed-invalidation variant.
- Bulk storage primitives (`deleteReadModels(pairs)`, `addCacheKeysBulk(entries)`).
- `EventProcessorRunner` skeleton retained intentionally despite most code being stripped; may receive pipeline pieces back in a future investigation. Do not delete.

## Related

- [ADR 0001 (client)](0001-anticipated-event-submit-vs-pipeline.md) — Anticipated event application: submit-time and pipeline-time are separate concerns. The "do not collapse `onApplyAnticipatedOp` into the pipeline" invariant is load-bearing for this design.
- [ADR 0005 (client)](0005-reconcile-entry-point-split.md) — Reconcile entry-point split. Phase 3's deferred-write conversion lands in this work; the `commit(mutations)` single-write entry point realizes the "all writes at the end" rule for that flow.
- [ADR 0006 (client)](0006-command-store.md) — `CommandStore`. `batchUpdateSyncStatus` is the canonical consumer of the synchronous batch update API.
- [ADR 0003 (client)](0003-server-data-pipeline-rewrite.md) — Server data pipeline rewrite. This ADR is one slice of the umbrella rewrite documented there; the cleanup-before-write race that motivates the `'applied'` split is one of the structural problems [ADR 0003](0003-server-data-pipeline-rewrite.md) enumerates.
