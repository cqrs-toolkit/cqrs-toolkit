# Item metadata shape: standalone or embedded?

## Context

[`§9.5.1`](../intent/requirements/0009-query-manager.md#951-record-lookup) and [`§9.5.2`](../intent/requirements/0009-query-manager.md#952-collection-listing) of `0009-query-manager.md` specify that pull queries return `ItemMeta` (change-detection / identity metadata: `id`, `updatedAt`, `clientId?`, `revision?`) alongside the item data.

The intent expresses flexibility on how the metadata is surfaced — either as a standalone field (`meta: ItemMeta` alongside `data`, or `meta: ItemMeta[]` parallel to `data` for lists) or embedded into the data shape itself.

## Observation

Surfaced during 2026-05-07 review. Both shapes can fulfill the underlying intent of providing per-item metadata alongside the data. The current implementation uses the standalone parallel-array form for `ListQueryResult`. Whether to migrate toward an embedded form (or add it as an alternative) is an open question.

## Considerations

**Standalone:**

- Cleaner separation between consumer-defined data shape and library-injected metadata.
- Doesn't pollute the consumer's data type with library-private fields.
- Parallel-array indexing requires consumers to track index alignment when iterating.

**Embedded:**

- Single object per item; no index alignment concern.
- Consumers iterating data items have direct access to metadata without a sibling lookup.
- Pollutes the consumer's data type, though this is mitigable with namespaced fields (e.g. `_meta`).
- Solid's `reconcile` with `key: 'id'` works directly on items; embedded metadata aligns naturally with that pattern.

## Status

Open. Both shapes are considered acceptable; current implementation uses standalone. Future refactors may switch or add the embedded alternative as long as the intent of providing per-item metadata is fulfilled.
