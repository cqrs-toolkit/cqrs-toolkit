# Stateful refetch batching strategy

## Context

When a stateful event triggers a refetch (per the `InvalidationScheduler` flow in [`§5.7`](../intent/requirements/0005-sync-manager.md#57-stateful-event-handling) of `0005-sync-manager.md`), the strategy by which batched refetches are executed is open. Refetch is debounced per `(collection, cacheKey)` to prevent stampedes; the batching mechanism inside the refetch is what's open.

Surfaced from the previous open-ambiguities section. Related to but distinct from [`stateful-event-redesign.md`](stateful-event-redesign.md), which covers the broader stateful-event design.

## Open considerations

The Sync Manager may use:

- **`lastUpdated >= timestamp`** — fetch only records updated since the last seen stateful event. Requires the server to support a `lastUpdated`-style filter.
- **Cursor-based batching** — fetch with a server-provided cursor; depends on the server's cursor model.
- **Fetch latest snapshot** — re-execute the seed flow against current server state. The current implementation's correctness-first interim approach.
- **Hybrid** — choose per-collection based on what the server supports.

The exact strategy may vary per service and does **not** affect correctness as long as stampede prevention and eventual consistency are preserved.

## Status

Open. Implementation choice — the current default is full seed-flow re-execution (correctness-first interim) per [`§5.7`](../intent/requirements/0005-sync-manager.md#57-stateful-event-handling) of `0005-sync-manager.md`. Incremental strategies will be revisited alongside the broader stateful-event redesign.
