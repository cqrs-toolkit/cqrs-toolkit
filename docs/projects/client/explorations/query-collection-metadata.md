# Query collection metadata: sync getter or observable signals?

## Context

[`§9.6`](../intent/requirements/0009-query-manager.md#96-query-metadata-optional-but-recommended) of `0009-query-manager.md` specifies a synchronous metadata getter:

```ts
getCollectionMeta({ collectionName, cacheKey }) -> {
  seeded: boolean;
  lastUpdatedAt?: number;
}
```

The implementation has not added this method. Instead, the same metadata is available via the `watchCollection(collection)` Observable (`CollectionSignal` discriminated union — `seed-completed`, `updated`, `sync-failed`).

## Observation

Surfaced during 2026-05-07 review. Two viable directions:

1. **Add the sync getter alongside `watchCollection`.** Useful for one-shot queries ("is this collection seeded right now?") that don't want an observable subscription. Implementation reads from `SeedStatusIndex` directly.
2. **Drop the sync getter; rely solely on `watchCollection`.** Consumers wanting one-shot read can `take(1)` from the observable, or read `SeedStatusIndex` directly via an internal API. Less surface to maintain.

Preference unclear without consumer driver. Solid primitives use observables natively; non-Solid consumers may prefer a sync getter.

## Status

Pending. The [`§9.6`](../intent/requirements/0009-query-manager.md#96-query-metadata-optional-but-recommended) spec stays as-is until a determination lands; both shapes fulfill the underlying intent of "expose collection lifecycle metadata for UI orchestration."
