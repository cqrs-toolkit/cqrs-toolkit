# `serverData` drop when no overlay

## Context

`ReadModelRecord` carries both `serverData: string | null` (server baseline) and `effectiveData: string` (overlay-applied effective state). When no overlay is present, the two are identical, doubling per-record storage.

## Observation

Surfaced during 2026-05-07 review of [`§7.4`](../intent/requirements/0007-read-model-store.md#74-server-baseline-vs-effective-overlay-semantics) of `0007-read-model-store.md`. The intent is to keep `serverData` populated only when an overlay exists. Current implementation keeps it always populated for code simplicity (so that if an overlay arrives later, the baseline is already at hand). This was logged as a tolerated deviation, not the design preference.

The cost is real: overlays are rare (on the high end ~1% of records carry one), so duplicating server state into a separate field doubles per-record storage for the common 99%. Storage pressure is already a known concern on some platforms (notably iOS).

## Open

How to drop `serverData` cleanly when no overlay is present:

- Restore-on-write trigger: as soon as the first overlay-producing event arrives, capture the current `effectiveData` into `serverData` before applying the overlay. Requires reliably knowing what the server-confirmed state was at the moment of overlay arrival.
- Lazy materialization: synthesize `serverData` on demand from the underlying event log. Only viable if the relevant permanent events are still available.
- Recompute from events: similar but requires reliable event retention.

Cross-cuts with [`§7.4`](../intent/requirements/0007-read-model-store.md#74-server-baseline-vs-effective-overlay-semantics) storage rules (under-intent vs current implementation) and the broader stateful redesign (which may also rework the baseline/overlay model).

## Status

Open. Revisiting is a priority/scheduling matter, not waiting for a trigger condition.
