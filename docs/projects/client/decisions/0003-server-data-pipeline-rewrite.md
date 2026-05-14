# ADR 0003 (client) — Rewrite the server data pipeline: replace the multi-class implementation with a single-owned reconcile path

**Status:** Accepted (Documented retroactively 2026-05-06; decision taken in mid-April 2026 ahead of the first landing commit `707b14b` on 2026-04-22)

This ADR documents the umbrella rewrite that ADRs [0004](0004-aggregates-as-first-class.md), [0005](0005-reconcile-entry-point-split.md), [0006](0006-command-store.md), [0007](0007-applied-status-split.md), and [0008](0008-applied-detection-simplification-and-wait-api-split.md) each describe a slice of.
It exists to capture the meta-decision in its own decision-of-record so the _why_ of the rewrite is not scattered across five ADRs (and only mentioned incidentally in [ADR 0001](0001-anticipated-event-submit-vs-pipeline.md)'s Related section and [ADR 0008](0008-applied-detection-simplification-and-wait-api-split.md)'s "EventProcessorRunner deleted" subsection).
The rewrite was decided before any of ADRs [0004](0004-aggregates-as-first-class.md), [0005](0005-reconcile-entry-point-split.md), [0006](0006-command-store.md), [0007](0007-applied-status-split.md), and [0008](0008-applied-detection-simplification-and-wait-api-split.md) was authored; this ADR's number (0003) is creation order, not decision order.

## Context

Before the rewrite, the path that turned server-originated data into committed read-model state on the client was split across multiple coordinating classes, each owning a piece of the lifecycle but no class owning the lifecycle as a whole.
The participants were:

- **`EventProcessorRunner`** — the pipeline-side event processor.
  Lookup by event type via `EventProcessorRegistry`.
- **`EventCache`** — event caching, dedup, gap detection, gap-buffer cleanup, `markProcessed` bookkeeping.
- **`CommandQueue.reconcileAfterServerEvents`** — a single bundled method that loaded pending commands and affected read models, applied incoming server events, and walked the commands to regenerate anticipated events.
  Three concerns in one function with implicit branching for the WS-event vs read-model-snapshot shapes.
- **The legacy id-rewrite cascade in `CommandQueue`** — `reconcileCreateIds`, `rewriteCommandsWithStaleIds`, `resolveDependentRevision`.
  Each step touched overlapping state through different entry points; ID rewriting was duplicated between this cascade and the in-pipeline apply.
- **`AnticipatedEventHandler.cleanup(commandId, terminalStatus)`** — overlay cleanup that ran synchronously from `CommandQueue.updateCommandStatus` at the `'succeeded'` transition.
  Wiped the optimistic overlay before the corresponding server data was written by the next pipeline drain, leaving entities visibly absent in between.

The structural problems that motivated the rewrite, in roughly the order they surfaced during design review:

1. **Conflated load / apply / reconcile.**
   `reconcileAfterServerEvents` bundled three orthogonal concerns: pulling state out of storage, folding the incoming server change into it, and regenerating per-command anticipated events.
   The single-entry-point shape forced both server-change shapes (WS event batches and read-model snapshots) through the same path, which made "what gets loaded for this server change" implicit and "where does the idMap come from" tangled with the apply step (events surface tempId resolutions in payloads; snapshots surface them in record IDs).
2. **The fold reached into storage.**
   The reconcile loop was not a pure function of in-memory state — it loaded and saved as it went, which precluded unit-testing it as a fold and blocked the `idReferences` reconciliation walk (which wants pure-function semantics: data + refs in, patched data out).
3. **Multiple owners of overlapping mutable state.**
   `CommandQueue` owned chains and the legacy id-rewrite cascade; `AnticipatedEventHandler` owned `anticipatedUpdates`; `EventProcessorRunner` owned per-event apply logic; `EventCache` owned event bookkeeping.
   No single component owned write ordering across these state holders, and bugs cascaded:
   - Chains never evicted on failure/cancellation, so retries latched onto dead `createCommandId` / `createdEntityId` pointers.
   - Regenerated anticipated events left `affectedAggregates` stale (frozen at enqueue-time client streamIds).
   - Dual-index re-reconcile was not guarded against re-entry through both keys of the client→server mapping.
   - `AnticipatedEventHandler` cleanup never touched chains, so a failed-then-retried create found stale chain state.
   - WS events advanced `knownRevisions` and the read model but not chain `lastKnownRevision`, leaving AutoRevision resolution and the read model drifting apart under WS load.
4. **Cleanup-before-write race on the success path.**
   `AnticipatedEventHandler.cleanup` ran synchronously at the `'succeeded'` transition, while the corresponding server data was written by a fire-and-forget `reconcile-ws-events` write-queue op scheduled by `SyncManager.handleCommandResponseEvents`.
   Cleanup wiped the overlay first; the drain wrote server data after.
   Between those two points the entity was visibly gone from the UI — especially on creates, where `clearLocalChanges` deletes the row outright when there is no server baseline.
   This was the visible cause of multiple broken demo e2e tests for create-then-assert flows.
5. **Duplicated id handling.**
   The legacy cascade (`reconcileCreateIds` + `rewriteCommandsWithStaleIds` + `resolveDependentRevision`) and the in-pipeline apply both rewrote IDs, against overlapping state, with no single declared shape for what an aggregate's identity actually was.
   This is the structural gap that [ADR 0004](0004-aggregates-as-first-class.md) closes by promoting aggregates to a first-class concept on `Collection`.
6. **Event-type-keyed processor lookup leaked into a class.**
   `EventProcessorRunner` carried state and bootstrap construction even after most of its code was stripped — its remaining role was lookup-by-event-type, which is what `EventProcessorRegistry` already does.
   The class persisted on the speculation that "the pipeline might recoalesce around it" (preserved through [ADR 0007](0007-applied-status-split.md)); that speculation didn't hold up.

These were not independent bugs to be fixed in place.
The structural form — multiple coordinating classes, each owning a slice of overlapping mutable state, with no owner of the lifecycle as a whole — generated this class of bug repeatedly.
A surface-level fix to any one of these problems left the others producing variants of the same drift.

## Decision

**Replace the multi-class server data pipeline with a single owned path.**

The new architecture has one component that owns server-data ingestion end-to-end (`SyncManager`), driving a layered pipeline whose each layer is a pure function of explicit inputs and produces explicit outputs.
No state is held in standalone runner classes; lookup-only concerns become registries; per-command memory is owned by a dedicated store.

The rewrite decomposes into the following sub-decisions, each documented in its own ADR:

- **[ADR 0004 (client)](0004-aggregates-as-first-class.md)** — Promote aggregates to a first-class concept on `Collection`.
  Replaces the ad-hoc `getStreamId` / `matchesStream` pair and the hardcoded `$.id` self-ID convention with a declared `aggregate` field plus `idReferences` declarations.
  Closes problem (5).
- **[ADR 0005 (client)](0005-reconcile-entry-point-split.md)** — Reconcile entry-point split: `reconcileFromWsEvents` and `reconcileFromSnapshot`, with a pure `reconcilePendingCommands` fold underneath.
  Replaces the bundled `reconcileAfterServerEvents`.
  Closes problems (1) and (2).
  The shared `reconcileAndPersist` body — extracted eagerly, not "later if costly" as the ADR initially planned — is what owns the load → apply → reconcile → persist sequence.
  This is the structural inversion: where the old pipeline had multiple components mutating overlapping state with no owner of write ordering, the new pipeline has one body owning all of it, with a pure fold inside.
- **[ADR 0006 (client)](0006-command-store.md)** — `CommandStore`: in-memory ownership of `CommandRecord` lifecycle.
  Removes the previous pattern where command-record memory was scattered across the queue, the storage layer, and ad-hoc caches.
- **[ADR 0007 (client)](0007-applied-status-split.md)** — `'applied'` status split: relocate anticipated-event cleanup off the success transition.
  Closes problem (4) — the cleanup-before-write race — by moving overlay cleanup into the pipeline, where the decision "the server's effects are reflected in `serverData`" is detectable.
  _Superseded by [ADR 0008](0008-applied-detection-simplification-and-wait-api-split.md)._
- **[ADR 0008 (client)](0008-applied-detection-simplification-and-wait-api-split.md)** — Simplify `'applied'` coverage detection; split command-wait API into `waitForSucceeded` / `waitForApplied`.
  Replaces the elaborate `pendingAggregateCoverage` design from [ADR 0007](0007-applied-status-split.md) with a primary-aggregate revision check, and exposes the post-terminal `applied` transition to consumers.
  Deletes `EventProcessorRunner`, closing problem (6) — its lookup-only residue collapses into `EventProcessorRegistry`, and its orchestration responsibilities move onto `SyncManager`.

**One invariant held across the rewrite.**
The submit-time anticipated-event application stays — `AnticipatedEventHandler.onApplyAnticipatedOp` is _not_ folded into the pipeline.
This was attempted in a prior cleanup-timing redesign, broke things badly, and was restored.
[ADR 0001 (client)](0001-anticipated-event-submit-vs-pipeline.md) is the load-bearing ADR for this invariant; the rewrite does not touch it.

## Consequences

### Implementation impact

The rewrite landed bundled in commit `707b14b` (2026-04-22), supersession `84dc12f` (2026-04-27). Per-slice implementation impact is documented in [ADRs 0004](0004-aggregates-as-first-class.md), [0005](0005-reconcile-entry-point-split.md), [0006](0006-command-store.md), [0007](0007-applied-status-split.md), and [0008](0008-applied-detection-simplification-and-wait-api-split.md). At the umbrella level:

- Decomposition of `reconcileAfterServerEvents` into an entry-point split + pure shared fold.
- Removal of `EventProcessorRunner` (the closing slice; see [ADR 0008](0008-applied-detection-simplification-and-wait-api-split.md)).
- Introduction of `CommandStore` as sole owner of `CommandRecord` lifecycle ([ADR 0006](0006-command-store.md)).
- Promotion of aggregates to first-class on `Collection` with `idReferences` declarations ([ADR 0004](0004-aggregates-as-first-class.md)).
- Relocation of overlay cleanup off the success transition via the `'applied'` post-terminal status ([ADRs 0007](0007-applied-status-split.md)/[0008](0008-applied-detection-simplification-and-wait-api-split.md)).
- **Outstanding:** legacy cascade methods `rewriteCommandsWithStaleIds` and `resolveDependentRevision` remain as private methods on `CommandQueue`. Both rewrite entry points are wired (the precondition [ADR 0005](0005-reconcile-entry-point-split.md) set); removing the legacy methods is the closing follow-up. See [ADR 0005](0005-reconcile-entry-point-split.md)'s "Naming and shape reconciliation for current readers" section for current status.

The bundled landing was deliberate — the structural problems above were entangled enough that fixing them in isolation would have left half-rewrites in tree. A consequence is that the rewrite is not bisectable into the per-slice ADRs in git history; reviewing the rewrite means reviewing the umbrella.

### Operational implications

#### Gains

- **One owner of write ordering.**
  Every server-data write goes through `reconcileAndPersist`, which builds a single mutation list (per-command updates → read-model mutations → anticipated-event updates) and issues one batch.
  The "all reads up front, all writes at the end" contract is structural, not a convention to be remembered.
- **The applied-status mechanism gives consumers a wait semantic that matches reality.**
  Fast confirmation (`succeeded`) and data-reflected (`applied`) are exposed as separate waiters (per [ADR 0008](0008-applied-detection-simplification-and-wait-api-split.md)); the cleanup-before-write race is gone.

### Coding implications

#### Gains

- **The reconcile fold is unit-testable.**
  `reconcilePendingCommands` takes explicit inputs and returns explicit outputs.
  No storage stub.
  Bugs in the fold are reproducible from a fixture, not from a long-running integration test.
- **State drift bugs collapse into one place.**
  The chains-vs-read-model drift, the stale `affectedAggregates`, the dual-index re-entry, the cleanup-vs-chains gap, and the WS-revision-vs-chain drift were all consequences of multiple owners.
  With one owner of the lifecycle and pure inputs to the fold, these become single-point fixes inside `reconcileAndPersist` rather than cascading multi-class refactors.
- **Aggregates have a declared shape.**
  `idReferences` lets the pipeline patch IDs uniformly across read-model rows and anticipated events without per-collection special cases (per [ADR 0004](0004-aggregates-as-first-class.md)).
- **Lookup-only concerns are not classes.**
  `EventProcessorRegistry` is a registry; the orchestration that lived in `EventProcessorRunner` lives in `SyncManager`.
  No per-event runner state to keep in sync.

#### Costs

- **`SyncManager` is bigger.**
  Centralizing load → apply → reconcile → persist into one body trades surface area between classes for vertical depth in one class.
  Subsequent work has had to be careful about not letting `reconcileAndPersist` accrete unrelated phases — see, for example, the discipline of staging Phase 3 writes into `DeferredApplication[]` so that `reconcileAndPersist`'s mutation list is the single write entry point ([ADR 0007](0007-applied-status-split.md)).
- **Two entry points means duplicated loading.**
  `reconcileFromWsEvents` and `onApplyRecords` each own their own loading strategy.
  A future need to change "what's loaded for a given server change" requires touching both (or extracting a load helper).
  Acceptable today; flagged in [ADR 0005](0005-reconcile-entry-point-split.md)'s Consequences.

## Notes

This ADR is the "we tried the multi-class shape, here's what was structurally wrong with it, here's what replaced it" record.
Future contributors who find themselves proposing to re-decompose the pipeline into per-concern runner classes should read this ADR before opening that conversation.
The class taxonomy that existed before — `EventProcessorRunner`, the legacy cascade in `CommandQueue`, the synchronous cleanup at `'succeeded'` — was tried and produced the bug class enumerated in Context.

The "in-memory state in server-id space" framing from [ADR 0005](0005-reconcile-entry-point-split.md) is part of the same architectural inversion: once the entry point has rewritten command data and built the dirty set, the rest of the fold operates as if tempIds never existed.
This is what makes the fold pure — and what made the legacy cascade redundant.
Re-introducing tempId-aware branches into `reconcilePendingCommands` is a sign the upstream rewrite is incomplete, not that the fold needs more cases.

The decision to retain `EventProcessorRunner`'s skeleton through [ADR 0007](0007-applied-status-split.md) ("may receive pipeline pieces back in a future investigation; do not delete") was a hedge against the rewrite proving to need a runner-shaped component after all.
By the time of [ADR 0008](0008-applied-detection-simplification-and-wait-api-split.md) (five days later), the pipeline had clearly recoalesced around `SyncManager` + `EventProcessorRegistry` and the hedge was retired.
That retirement is the entry that prompted this ADR — without an umbrella record, the deletion read as a one-off cleanup rather than the closing of the rewrite.

## Related

- **[ADR 0001 (client)](0001-anticipated-event-submit-vs-pipeline.md)** — The submit-time / pipeline-time split.
  Load-bearing across the rewrite; not modified by it.
  [ADR 0001](0001-anticipated-event-submit-vs-pipeline.md)'s Related section currently notes the rewrite incidentally in its closing paragraphs; this ADR is the umbrella record those paragraphs gesture at.
- **[ADR 0004 (client)](0004-aggregates-as-first-class.md)** — Aggregates as first-class.
  One slice of this rewrite.
- **[ADR 0005 (client)](0005-reconcile-entry-point-split.md)** — Reconcile entry-point split.
  The structural inversion at the heart of this rewrite.
- **[ADR 0006 (client)](0006-command-store.md)** — `CommandStore`.
  Command-record ownership slice.
- **[ADR 0007 (client)](0007-applied-status-split.md)** — `'applied'` status split.
  Closes the cleanup-before-write race; superseded by [ADR 0008](0008-applied-detection-simplification-and-wait-api-split.md) for the coverage-detection mechanics.
- **[ADR 0008 (client)](0008-applied-detection-simplification-and-wait-api-split.md)** — Simplified coverage + wait-API split + `EventProcessorRunner` deletion.
  The closing slice of this rewrite.

### Naming and shape reconciliation for current readers

Some symbols cited in the Context section reflect the pre-rewrite codebase and no longer exist in current code:

- **`EventProcessorRunner`** — deleted in commit `84dc12f` (2026-04-27).
  Its responsibilities live across `SyncManager` (orchestration) and `EventProcessorRegistry` (lookup).
- **`reconcileAfterServerEvents`** — replaced by `reconcileFromWsEvents` and `onApplyRecords`, both delegating to the shared `reconcileAndPersist` body inside `SyncManager`.
- **`reconcileCreateIds`** — removed.
  Two stale JSDoc comments still mention it (per [ADR 0005](0005-reconcile-entry-point-split.md)'s reconciliation section); cleanup, not behavioral.
- **`rewriteCommandsWithStaleIds` / `resolveDependentRevision`** — still present as private methods on `CommandQueue`; their removal is the unfinished tail of the rewrite.
- **`AnticipatedEventHandler.cleanup(commandId, terminalStatus)`** — replaced by the three-method split `cleanupOnSucceeded` / `cleanupOnAppliedBatch` / `cleanupOnFailure` (per [ADR 0007](0007-applied-status-split.md)).
- **`reconcileFromSnapshot`** — never landed under that name.
  The snapshot side shipped split into `onApplyRecords` (read-model snapshot pages) and `onApplySeedEvents` (seed events, which delegates to `reconcileFromWsEvents`).
  See [ADR 0005](0005-reconcile-entry-point-split.md)'s reconciliation section for the rationale.
