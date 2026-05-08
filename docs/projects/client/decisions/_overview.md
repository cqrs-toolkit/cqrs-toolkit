# decisions/ (client)

ADRs scoped to `@cqrs-toolkit/client`.
Captures *why* design choices specific to the client were made.
Repo-wide decisions live in [`/docs/decisions/_overview.md`](../../../decisions/_overview.md).

## Decisions

- [ADR 0001 — Anticipated events: submit-time and pipeline-time are separate concerns](0001-anticipated-event-submit-vs-pipeline.md) — load-bearing for any work that touches optimistic-update flow; the design has been re-attempted and reverted before. Surfaced in the project's `Always Read entries`.
- [ADR 0002 — Per-collection read-model tables, library-generated DDL, typed migration steps](0002-per-collection-read-model-tables.md) — the schema split that shipped; consumer-owned DDL and promoted columns are explicit future work.
- [ADR 0003 — Rewrite the server data pipeline: replace the multi-class implementation with a single-owned reconcile path](0003-server-data-pipeline-rewrite.md) — umbrella for the multi-class server-data-pipeline rewrite; ADRs [0004](0004-aggregates-as-first-class.md), [0005](0005-reconcile-entry-point-split.md), [0006](0006-command-store.md), [0007](0007-applied-status-split.md), and [0008](0008-applied-detection-simplification-and-wait-api-split.md) each describe a slice. Read this before proposing to re-decompose the pipeline into per-concern runner classes.
- [ADR 0004 — Aggregates as a first-class concept on `Collection`](0004-aggregates-as-first-class.md) — `Collection.aggregate` + `idReferences` + EntityId-aware ID extraction across internal APIs.
- [ADR 0005 — Reconcile entry-point split: `reconcileFromWsEvents` and `reconcileFromSnapshot`](0005-reconcile-entry-point-split.md) — two entry points, one shared pure fold; entry points own load + apply + idMap detection + persist.
- [ADR 0006 — `CommandStore`: in-memory ownership of `CommandRecord` lifecycle](0006-command-store.md) — single owner of command-record memory + `seq`-based ordering + flush-queue coalescing.
- [ADR 0007 — `'applied'` status split: relocate anticipated-event cleanup off the success transition](0007-applied-status-split.md) — superseded by [ADR 0008](0008-applied-detection-simplification-and-wait-api-split.md).
- [ADR 0008 — Simplify `'applied'` coverage detection; split command-wait API into `waitForSucceeded` / `waitForApplied`](0008-applied-detection-simplification-and-wait-api-split.md) — primary-aggregate revision check; new wait-API split exposes the post-terminal `applied` transition to consumers.
