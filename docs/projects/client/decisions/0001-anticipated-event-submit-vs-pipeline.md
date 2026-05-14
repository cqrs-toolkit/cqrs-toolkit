# ADR 0001 (client) — Anticipated event application: submit-time and pipeline-time are separate concerns

**Status:** Accepted (Documented 2026-05-04; original decision and re-affirmation dates not precisely known)

## Context

`@cqrs-toolkit/client` applies a command's anticipated events twice along their lifecycle:

1. **At submit time**, when `client.submit()` is called.
   `AnticipatedEventHandler.onApplyAnticipatedOp` writes the optimistic overlay to the read model store immediately, before the command leaves the queue or contacts the server.
2. **In the sync / WebSocket pipeline**, after the command's response or related events flow through `EventCache` and `EventProcessorRunner`.
   The pipeline's job for anticipated events is supersede / re-evaluate / pass-through per command on drain — handling reconciliation against confirmed server events and regeneration when input state changes.

These look superficially redundant ("we apply the events at submit _and_ in the pipeline?") and the natural reaction during a cleanup-timing redesign is to fold the two together: have the pipeline be the single applier, with submit-time just enqueueing.

That fold has been attempted before.
Removing `onApplyAnticipatedOp` caused massive problems and had to be restored, costing a full day of wasted work.
The same fold has been suggested at least twice during subsequent cleanup-timing redesigns.

The two applications are doing different jobs:

- **Submit-time application** must happen immediately and synchronously with `client.submit()` so the UI shows predicted state without waiting for a pipeline drain.
  The user typed something, hit save, and expects the optimistic update _now_ — not after the next pipeline tick, not after the next event arrives, _now_.
  Without submit-time application, the UI lags command submission by the full pipeline latency, which is unacceptable for an offline-first / optimistic-UI library.
- **Pipeline-time reconciliation** handles the steady-state plumbing: dedup against incoming response events, regenerate overlays when other commands' inputs change, propagate updates to all consumers.
  It is not "applying the anticipated events for the first time" — it is updating an overlay that already exists.

`AnticipatedEventHandler` owns the `anticipatedUpdates` tracking map as the system of record.
The pipeline updates entries in that map during regeneration; it does not own the map.

## Decision

`AnticipatedEventHandler.onApplyAnticipatedOp` and the submit-time overlay write **stay**.
The submit-time application is a separate concern from the sync-pipeline application of anticipated events, and they coexist by design.

The pipeline's role with respect to anticipated events is:

- Supersede the overlay when the corresponding response event arrives.
- Re-evaluate the overlay when an input the command depended on changes.
- Pass-through (leave the existing overlay in place) when the command is still pending and inputs have not changed.

The pipeline's role is **not** "apply the anticipated events for the first time."
That happens at submit time.

`anticipatedUpdates` lives on `AnticipatedEventHandler`.
The pipeline updates entries during regeneration but does not own the map.

## Consequences

This is a policy-of-record ADR — it documents an existing invariant and the bug class that motivated keeping it. No implementation impact.

### Operational implications

#### Gains

- Submit-time UI feedback is immediate.
  This is what consumers of an optimistic-UI library expect.

#### Costs

- Bugs in either flow produce visible UI artifacts in different shapes: submit-time bugs show as immediate UI errors; pipeline-time bugs show as eventual-consistency drift.
  Both must be diagnosed in their own terms — neither flow's symptoms substitute for the other's.

### Coding implications

#### Gains

- The pipeline's job is well-scoped: reconciliation, not initial application.
  Bugs in cleanup timing do not cascade into "did we ever apply this event at all?"
- The two flows can evolve independently — fixing a pipeline issue does not require redesigning submit-time application, and vice versa.

#### Costs

- The two flows look redundant on first read.
  This ADR exists so future contributors don't fall into the same trap of trying to merge them.

## Notes

When discussing anticipated event flow in design or refactor work:

- Treat submit-time application and sync-pipeline-time reconciliation as two separate steps that both exist.
- Bugs in cleanup timing or pipeline dedup are _not_ justifications for collapsing the two.
- The `anticipatedUpdates` tracking map stays on `AnticipatedEventHandler` as the system of record.

## Related

This decision pre-dates the formal castle.
Authored retroactively from a feedback memory captured on 2026-04-14 after the second attempt to fold the two flows.
The original removal/restoration cycle predates that.

The Context section references `EventProcessorRunner` because that was the pipeline-side event processor at the time of the decision (introduced 2026-03-02, commit `84f7414`).
The class was removed on 2026-04-27 (commit `84dc12f`, "Split command waits into waitForSucceeded and waitForApplied") during a server-data-processing rewrite; its responsibilities now live across `SyncManager` (pipeline orchestration) and `EventProcessorRegistry` (processor lookup).
The submit-time / pipeline-time split this ADR establishes is unchanged by that rewrite — only the pipeline-side implementation was reshaped.
