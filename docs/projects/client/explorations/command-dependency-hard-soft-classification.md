# Hard/soft classification of command dependencies — open questions

## Status

Resolved sections drafted into [ADR-0009 (client) — Hard/soft classification of `dependsOn` edges with source-tagged origins](../decisions/0009-hard-soft-dependency-classification.md) (`Proposed` 2026-05-11). The implementation and spec edits landed alongside the ADR — see [`0004 §4.4`](../intent/requirements/0004-command-queue.md#44-command-record-schema), [`§4.6.1`](../intent/requirements/0004-command-queue.md#461-dependencies), [`§4.8.2`](../intent/requirements/0004-command-queue.md#482-failure-category-taxonomy), [`§4.8.3`](../intent/requirements/0004-command-queue.md#483-pluggable-failure-mapping), and [`0014 §14.6.1`](../intent/requirements/0014-entity-ref.md#1461-automatic-dependson).

This exploration persists only to track open questions deferred for future work. The decided design + alternatives-considered narrative lives in the ADR; the runtime contract lives in the spec; this file holds nothing else.

## Open questions

### Cross-aggregate edges

ADR-0009's design assumes a single aggregate per chain. A command can touch multiple aggregates via `affectedAggregates` and therefore sit in multiple aggregate chains, so the same `(A, B)` pair may have different classifications relative to each chain it appears in.

The current implementation dedupes to one classifier call per `(A, B)` pair regardless of how many chains they share — the classifier returns one `'hard' | 'soft'` for the pair as a whole. That's correct for single-aggregate chains and probably good enough for many cross-aggregate cases, but it doesn't expose per-chain context.

Open: when a concrete cross-aggregate case forces the question, decide whether the signature should expose the chains (`classifyDependency(myCommand, dependsOnCommand, sharedChains)`), whether composition rules should be added (any-hard wins; all-soft for all-soft; etc.), or whether the consumer should decompose into multiple classifier registrations keyed differently. The proof case will drive the design; guessing now risks the wrong shape.

### Chain snapshot on the classifier signature

`classifyDependency`'s signature in ADR-0009 carries `(myCommand, dependsOnCommand)` only — no snapshot of the surrounding chain. The implementation could pass a chain view (predecessors, successors, latestCommandId, etc.) so the classifier can reason about position rather than just the pair.

Not in the first cut because no consumer use case has demonstrated need yet, and a signature widening is easy to do later (additive parameter) but hard to walk back. Worth revisiting when a real classifier wants to inspect neighbouring commands rather than just the direct edge — for example, "hard if I'm the only command between A and the next succeeded checkpoint" or "soft if there's already a more-specific command between us."

## When this file resolves

If both open questions get resolved (via separate ADRs or follow-on edits to ADR-0009), and no new open questions surface, this file is deleted with a one-line entry in [`projects/client/evolution/_overview.md`](../evolution/_overview.md) recording the resolution and pointing at the ADR(s) that closed the questions.

If one of the questions is investigated and rejected (e.g., "we decided chain snapshot will never be needed because X"), this file keeps the rejection note in place rather than deleting the question — institutional knowledge against re-litigating.
