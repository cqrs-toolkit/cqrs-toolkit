# client — changelog

Append-only history of significant changes to the `@cqrs-toolkit/client` project castle.
Per-requirement substantive changes are recorded in each requirement's paired `-log.md` file (created lazily on first change); this file records wing-level structural events and cross-cutting changes.

## 2026-05-22 — Requirement 0016 + ADR 0010 added: custom collations graduated from exploration

Graduated the `locale-aware-sort` exploration into the requirements wing now that the V1 contract has landed end-to-end. Created [`intent/requirements/0016-custom-collations.md`](../intent/requirements/0016-custom-collations.md) documenting the decided contract — `CollationConfig`, `CqrsConfig.collations`, widened `CustomColumn.collation`, per-connection registration in `loadAndOpenDb`, `SortResolverLookup` for Mode A parity, `unsupportedCollations: 'error' | 'degrade'` policy for backends without `sqlite3_create_collation_v2`, and the comparator-immutability invariant.

The load-bearing rejected alternatives moved to [ADR 0010](../decisions/0010-custom-collations-design.md) — ICU extension, pre-folded ASCII sort keys, server-driven sort. [`explorations/locale-aware-sort.md`](../explorations/locale-aware-sort.md) was trimmed to the items intentionally deferred past V1: per-query `COLLATE` overrides, devtools cooperation, comparator performance benchmarking, runtime fingerprint check for the determinism contract.

## 2026-05-06 — ADR 0003 added: server data pipeline rewrite (umbrella decision-of-record)

Wrote [ADR 0003](../decisions/0003-server-data-pipeline-rewrite.md) to capture the umbrella decision behind the multi-class server-data-pipeline rewrite that ADRs [0004](../decisions/0004-aggregates-as-first-class.md), [0005](../decisions/0005-reconcile-entry-point-split.md), [0006](../decisions/0006-command-store.md), [0007](../decisions/0007-applied-status-split.md), and [0008](../decisions/0008-applied-detection-simplification-and-wait-api-split.md) each describe a slice of.

Why retroactively: the rewrite was decided in mid-April 2026 and landed across commits `707b14b` (2026-04-22) and `84dc12f` (2026-04-27).
ADRs [0004](../decisions/0004-aggregates-as-first-class.md), [0005](../decisions/0005-reconcile-entry-point-split.md), [0006](../decisions/0006-command-store.md), and [0007](../decisions/0007-applied-status-split.md) (all Accepted 2026-04-22) and [ADR 0008](../decisions/0008-applied-detection-simplification-and-wait-api-split.md) (Accepted 2026-04-27) each documented one slice — but the _why_ of the rewrite as a whole, and the structural problems with the previous multi-class form, lived only in incidental Related-section paragraphs.
A future contributor proposing to re-decompose the pipeline into per-concern runner classes had no umbrella ADR to read; the deletion of `EventProcessorRunner` in [0008](../decisions/0008-applied-detection-simplification-and-wait-api-split.md) read as a one-off cleanup rather than the closing of a larger rewrite.

Changes:

- Created [`decisions/0003-server-data-pipeline-rewrite.md`](../decisions/0003-server-data-pipeline-rewrite.md).
- Added an index entry in [`decisions/_overview.md`](../decisions/_overview.md).
- Added Related-section back-pointers to [ADR 0003](../decisions/0003-server-data-pipeline-rewrite.md) in ADRs [0004](../decisions/0004-aggregates-as-first-class.md), [0005](../decisions/0005-reconcile-entry-point-split.md), [0006](../decisions/0006-command-store.md), [0007](../decisions/0007-applied-status-split.md), and [0008](../decisions/0008-applied-detection-simplification-and-wait-api-split.md) — making the precedence explicit ([0003](../decisions/0003-server-data-pipeline-rewrite.md) is the umbrella; the rest are slices).

[ADR 0003](../decisions/0003-server-data-pipeline-rewrite.md)'s number is creation order, not decision order.
The decision predates ADRs [0004](../decisions/0004-aggregates-as-first-class.md), [0005](../decisions/0005-reconcile-entry-point-split.md), [0006](../decisions/0006-command-store.md), [0007](../decisions/0007-applied-status-split.md), and [0008](../decisions/0008-applied-detection-simplification-and-wait-api-split.md) chronologically; this is captured in the ADR's Status line and reinforced in its body.

## 2026-05-04 — Castle migration: requirements wing (with renumbering and content restructure)

Migrated the CQRS Client specification from `packages/client/docs/specification/` (with its `sections/` subdirectory) into this castle's [`intent/requirements/`](../intent/requirements/_overview.md) wing. The migration includes a section renumbering and content restructure that completed during the 2026-05-07 review pass; both are recorded together as one coherent migration since the renumbered file numbers are the committed-shape file numbers.

Changes:

- The original `specification/readme.md` index moved to `intent/requirements/_overview.md` and was rewritten for the new file layout, NNNN-slug naming, and the lazy-log-creation convention.

- 17 spec sections were moved via `git mv` to preserve history, and renamed from `lower_snake_case.md` under `sections/` to `NNNN-slug.md` directly under `intent/requirements/`, 1-indexed. Section heading numbers (the `# N.` line at the top of each file) were updated to match the new file numbers — eliminating a pre-migration gap in the source: the source content had headings §24 DevTools → §15 EntityRef → §15 Aggregate Configuration, with no §16. Both file numbers and section headings now run consecutively.

- One section file (`open_ambiguities.md`) was determined during the review pass to be misclassified — its content was redistributed: cross-cutting principles into [`0001-modes-and-constraints.md`](../intent/requirements/0001-modes-and-constraints.md) [§1.3](../intent/requirements/0001-modes-and-constraints.md#13-cross-component-invariants) (Cross-component invariants); deferred / open design items into the new [`explorations/`](../explorations/) wing as one-per-file stubs.

- One section file (`exploration_notes.md`) was likewise reclassified: its content (Active Tab Handoff for Non-SharedWorker Contexts) belongs in the explorations wing rather than the requirements wing. It was relocated to [`explorations/active-tab-handoff.md`](../explorations/active-tab-handoff.md).

- Per-requirement `-log.md` files were created lazily during the 2026-05-07 review pass as substantive changes to each requirement landed.

Old → new mapping:

| Old path                                       | New path                                                                                                                                                                                                                                          |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/client/docs/specification/readme.md` | [`_overview.md`](../intent/requirements/_overview.md)                                                                                                                                                                                             |
| `sections/modes_and_constraints.md`            | [`0001-modes-and-constraints.md`](../intent/requirements/0001-modes-and-constraints.md)                                                                                                                                                           |
| `sections/domain_layer.md`                     | [`0002-domain-layer.md`](../intent/requirements/0002-domain-layer.md)                                                                                                                                                                             |
| `sections/cache_manager.md`                    | [`0003-cache-manager.md`](../intent/requirements/0003-cache-manager.md)                                                                                                                                                                           |
| `sections/command_queue.md`                    | [`0004-command-queue.md`](../intent/requirements/0004-command-queue.md)                                                                                                                                                                           |
| `sections/sync_manager.md`                     | [`0005-sync-manager.md`](../intent/requirements/0005-sync-manager.md)                                                                                                                                                                             |
| `sections/event_cache.md`                      | [`0006-event-cache.md`](../intent/requirements/0006-event-cache.md)                                                                                                                                                                               |
| `sections/read_model_store.md`                 | [`0007-read-model-store.md`](../intent/requirements/0007-read-model-store.md)                                                                                                                                                                     |
| `sections/event_processors.md`                 | [`0008-event-processors.md`](../intent/requirements/0008-event-processors.md)                                                                                                                                                                     |
| `sections/query_manager.md`                    | [`0009-query-manager.md`](../intent/requirements/0009-query-manager.md)                                                                                                                                                                           |
| `sections/public_api.md`                       | [`0010-public-api.md`](../intent/requirements/0010-public-api.md)                                                                                                                                                                                 |
| `sections/eviction_contract.md`                | [`0011-eviction-contract.md`](../intent/requirements/0011-eviction-contract.md)                                                                                                                                                                   |
| `sections/open_ambiguities.md`                 | content redistributed: [§1.3](../intent/requirements/0001-modes-and-constraints.md#13-cross-component-invariants) invariants in [`0001`](../intent/requirements/0001-modes-and-constraints.md), open items in [`explorations/`](../explorations/) |
| `sections/aggregations.md`                     | [`0012-aggregations.md`](../intent/requirements/0012-aggregations.md)                                                                                                                                                                             |
| `sections/devtools.md`                         | [`0013-devtools.md`](../intent/requirements/0013-devtools.md)                                                                                                                                                                                     |
| `sections/exploration_notes.md`                | [`explorations/active-tab-handoff.md`](../explorations/active-tab-handoff.md)                                                                                                                                                                     |
| `sections/entity_ref.md`                       | [`0014-entity-ref.md`](../intent/requirements/0014-entity-ref.md)                                                                                                                                                                                 |
| `sections/aggregate_config.md`                 | [`0015-aggregate-config.md`](../intent/requirements/0015-aggregate-config.md)                                                                                                                                                                     |

The empty source directories `packages/client/docs/specification/sections/` and `packages/client/docs/specification/` were removed.

Drift correction (where the requirements no longer matched current code) was performed during the 2026-05-07 review pass and is recorded in each requirement's `-log.md` file.
