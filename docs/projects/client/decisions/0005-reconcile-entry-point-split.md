# ADR 0005 (client) — Reconcile entry-point split: `reconcileFromWsEvents` and `reconcileFromSnapshot`

**Status:** Accepted 2026-04-22

## Context

A single `reconcileAfterServerEvents` previously bundled three concerns:

1. **Loading** — pull pending commands and the affected read models out of storage.
2. **Applying** — fold the incoming server change (a WS event batch _or_ a read-model snapshot) into the loaded data.
3. **Reconciling** — walk pending commands in queue order, rewriting tempIds via the idMap, re-running domain executors for dirty commands, regenerating anticipated events.

The two server-change shapes — WS event batches arriving on the live socket and read-model snapshots arriving from seed/sync — share concerns 1 and 3 but differ in concern 2.
The single-entry-point shape forced both flows through the same code path with internal branching, which made:

- The "what gets loaded" decision implicit and hard to vary per entry point.
- The "where does the idMap come from" decision tangled with the apply step (each shape detects tempId resolutions differently — events surface them in payloads; snapshots surface them in record IDs).
- The fold over commands (`reconcilePendingCommands`) reach into storage, instead of operating purely on in-memory state.

The conflation also blocked the `idReferences` reconciliation walk introduced in [ADR 0004](0004-aggregates-as-first-class.md) — that walk wants pure-function semantics (data + refs in, patched data out), but the bundled `reconcileAfterServerEvents` was doing IO around it.

## Decision

**Two entry points, one shared fold.**

### Entry point A: `reconcileFromWsEvents(events, ...)`

1. Load pending commands.
2. Load relevant read models (collection × entity-id set obtained from an initial scan of the event array).
3. Apply events to the loaded read-model data — in memory, no store writes yet.
4. Detect tempId → serverId resolutions by comparing pre-apply ref ids against post-apply string ids. Build idMap.
5. Rewrite loaded command records' `data.id` / parentRef fields via idMap. Track which commands got rewritten as `rewrittenCommandIds`.
6. Collect the initial dirty set: entities whose server state changed in step 3, plus any `collection:tempId` keys that are about to be migrated.
7. Hand off to `reconcilePendingCommands` with: rewritten commands, loaded + updated read models, the dirty set, the tempIds-to-delete set.
8. Persist everything at the end — commands first, then read models, then anticipated events — in a single batch.

### Entry point B: `reconcileFromSnapshot(records, ...)`

Mirrors entry point A's eight steps, with snapshot-specific differences in steps 3 and 4 (a snapshot directly delivers post-apply state plus the implicit idMap from old → new record IDs).

### `reconcilePendingCommands` becomes pure

The fold accepts preloaded inputs, walks commands in queue order, runs `domainExecutor.handle` for dirty commands (dirty = primary entity in dirty set OR command in `rewrittenCommandIds`), folds events through processors into working state, returns a `ReconcileOutput` with updated anticipated events, final working state, and any entity keys marked for deletion.

**No loads, no saves.**
The reconcile fold operates entirely on in-memory state in server-id space — the idMap was applied upstream by the entry point, and the fold's caller persists.

### Naming

`reconcileFromWsEvents` / `reconcileFromSnapshot` — chosen to match the existing vocabulary around "reconcile" (the domain concept) and to make the entry-point shape explicit in the name.

### Persistence

Each entry point owns its own `persistReconcileBatch(preloadedState, reconcileOutput)` call at the end.
The current implementation duplicates the persist step across the two entry points (intentional initial implementation: don't pre-extract the shared helper until the second entry point is built and the duplication is real).
The shared helper can be extracted later if the duplication grows costly.

## Consequences

### Implementation impact

- Two entry points: `reconcileFromWsEvents` and the snapshot side (planned as `reconcileFromSnapshot`; shipped split into `onApplyRecords` for record-snapshot pages and `onApplySeedEvents` for seed-events — see Naming reconciliation).
- Pure `reconcilePendingCommands` fold accepting preloaded inputs and returning `ReconcileOutput` — no IO, no async.
- Shared `reconcileAndPersist` helper extracted eagerly (not deferred as planned).
- WS entry point absorbing pre-existing bookkeeping (dedup, gap detection, revision tracking, seed status updates, `markProcessed`, debug emits) into the batched drain.
- Two-step command rewrite phase: command-rewrite tracking via `rewrittenCommandIds` + dirty-set collection for the fold's downstream regenerate logic.

### Operational implications

#### Gains

- Each entry point's loading and applying logic is local to that entry point.
  WS-event-specific handling (event caching/dedup, gap detection, revision tracking, stateful vs permanent branch, gap-buffer cleanup, seed status updates, `markProcessed` on EventCache, debug emits) lives in the WS entry point and is not entangled with snapshot handling.

### Coding implications

#### Gains

- `reconcilePendingCommands` is unit-testable as a pure fold.
  Inputs are explicit; outputs are explicit; no storage stub required.
- The `idReferences` reconciliation walk from [ADR 0004](0004-aggregates-as-first-class.md) fits cleanly inside the entry point's command-rewrite step (5).
- The legacy cascade (`reconcileCreateIds` + `rewriteCommandsWithStaleIds` + `resolveDependentRevision` in `CommandQueue`) becomes removable once both entry points are wired into the WS receive path and command-response flows.

#### Costs

- The entry points each own their own loading strategy.
  A future need to change "what's loaded for a given server change" requires touching both entry points (or extracting a load helper).

## Notes

The "in-memory state in server-id space" framing is load-bearing.
Once the entry point has rewritten command data and built the dirty set, the rest of the fold operates as if tempIds never existed.
Future contributors should resist re-introducing tempId-aware branches into `reconcilePendingCommands` — that is a sign the upstream rewrite is incomplete, not that the fold needs more cases.

The persist step does not currently use a transaction.
Crash atomicity is provided by WriteQueue serialization at the storage layer — the persist batch enqueues writes in dependency order and either all run or none do.

## Related

- [ADR 0004 (client)](0004-aggregates-as-first-class.md) — Aggregates as a first-class concept on `Collection`.
  The `idReferences` walk used to rewrite cross-aggregate IDs in the entry point's command-rewrite step (5).
- [ADR 0003 (client)](0003-server-data-pipeline-rewrite.md) — Server data pipeline rewrite.
  The structural inversion this ADR describes (split entry points + pure shared fold + single-owner persist) is the centerpiece of that umbrella rewrite; [ADR 0003](0003-server-data-pipeline-rewrite.md) captures the _why_ across all the slices.

### Naming and shape reconciliation for current readers

This ADR was authored during the same multi-week rework as [ADR 0004 (client)](0004-aggregates-as-first-class.md) and the names/shape it cites are iteration-time framing.
The structural decision — split entry points + a pure shared fold — landed; some specifics evolved during implementation.
For present-day readers:

- **`reconcileFromWsEvents`** landed as named and stands.
  Lives as a private method on `SyncManager` (`packages/client/src/core/sync-manager/SyncManager.ts`).
- **`reconcilePendingCommands`** landed as named and as designed.
  It's a pure synchronous function in `core/sync-manager/reconcilePendingCommands.ts` taking `ReconcileInput`, returning `ReconcileOutput`. No IO, no async — exactly the "no loads, no saves" shape the Decision section calls for.
- **`reconcileFromSnapshot` and `persistReconcileBatch` never landed under those names.**
  `git log -S` shows no commits on any branch. Both were planning-time names.
- **The snapshot side shipped split into two sub-flavors**, not the single mirror this ADR described:
  - **`onApplyRecords`** (registered as the `'apply-records'` write-queue op) — the entry point for read-model snapshot pages from seed and refetch. It stages records into a `pendingApplications` list, builds the dirty set + cache-key map, advances `knownRevisions`, and hands off to the shared body (below). This carries the behavior the Decision section's Entry point B was responsible for.
  - **`onApplySeedEvents`** — the entry point for _seed events_ (server events arriving as part of seeding). It caches the events and delegates to `reconcileFromWsEvents`, since seed events have the same shape as live WS events.

  The records-vs-events split is intentional and not anticipated by this ADR: snapshots arrive as records, but seeding can also surface server events that need WS-style handling.
  Future contributors should not consolidate the two back into a single mirror without understanding why both shapes coexist.

- **The shared helper was extracted eagerly, not "later if costly."**
  The Decision section's Persistence subsection (line 53) said the persist step would be duplicated initially and extracted later if the duplication grew costly.
  In practice, **`reconcileAndPersist`** was extracted up-front as the shared body that both `reconcileFromWsEvents` and `onApplyRecords` delegate to.
  It owns the persist phase ("Phase 6") and invokes `reconcilePendingCommands` for the pure fold.
  The deferred-extraction framing in the body is no longer accurate; the helper exists today.
- **Legacy cascade is partially removed.**
  The Consequences section says the cascade becomes removable "once both entry points are wired."
  Both entry points are wired (via `reconcileAndPersist`), so the precondition is met; the removal is unfinished work, not a structural gap.
  Status today:
  - `reconcileCreateIds` — removed.
    Two stale JSDoc comments still mention it at `core/cache-manager/CacheManager.ts:429` and `core/cache-manager/types.ts:230`; small cleanup, no behavioral impact.
  - `rewriteCommandsWithStaleIds` — still present as a private method on `CommandQueue`.
  - `resolveDependentRevision` — still present as a private method on `CommandQueue`.

The decision (split entry points, pure shared fold, in-memory state in server-id space, persist-at-end) holds; the names and the persist-extraction timing diverged during implementation in favor of a cleaner structure than the ADR initially planned.
