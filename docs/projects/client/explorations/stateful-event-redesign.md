# Stateful event redesign

## Context

[`§5.7`](../intent/requirements/0005-sync-manager.md#57-stateful-event-handling) of `0005-sync-manager.md` covers stateful event handling. The current `InvalidationScheduler` triggers full seed-flow re-execution on stateful invalidation — correctness-first interim behavior, not the design end-state.

## Observation

Surfaced during 2026-05-07 review. The current implementation's primary purpose at this stage is keeping permanent-event flow consistent and ensuring stateful events do not corrupt the read model. It is not the intended end-state for stateful semantics.

The earlier spec language enumerated `lastUpdated` / `lastStatefulSeenAt` filter strategies, but these were never implemented — the realized behavior (full reflow) is correctness-first while a real stateful aggregate use case is pending.

## Likely directions to evaluate

- **Incremental stateful application.** Apply stateful events directly to the read model without full reflow when the event's data carries enough context. Requires tighter event-data shapes from the server.
- **Dedicated stateful APIs.** A separate `StatefulCollection` shape with its own update semantics, distinct from the event-sourced `Collection`. Avoids muddying the event-sourced model with best-effort semantics.
- **Hybrid.** Allow per-collection opt-in to incremental stateful handling, with the full-reflow fallback when the collection's processor signals invalidation.

## Status

Pending design. A real stateful aggregate use case (likely once the toolkit is being used to build an actual application with one) will drive the design. No urgency until then.
