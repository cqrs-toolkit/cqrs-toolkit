# Locale-aware string sort

## Status

Graduated 2026-05-22.
The custom-collation contract — `CollationConfig`, `CqrsConfig.collations`, widened `CustomColumn.collation`, per-connection registration, `SortResolverLookup` for Mode A parity, `unsupportedCollations` policy, determinism invariant — lives in [`0016-custom-collations.md`](../intent/requirements/0016-custom-collations.md).
Load-bearing rejected alternatives (ICU extension, ASCII sort keys, server-driven sort) live in [ADR-0010](../decisions/0010-custom-collations-design.md).

This file tracks the items intentionally deferred past V1.

## Open questions

- **Per-query `ORDER BY ... COLLATE x` overrides.**
  The shipped surface commits to schema-attached collations only — each `CustomColumn` carries at most one `COLLATE` clause in its DDL, and a query sorts by referencing the column.
  SQLite supports per-query `ORDER BY col COLLATE locale_x`, which would let a single column drive multiple sort orders at query time — at the cost of being unindexed unless a matching expression index exists.
  Defer until a callsite demands it; revisit alongside any future expression-index work.

- **Devtools cooperation.**
  The devtools panel ([`0013-devtools.md`](../intent/requirements/0013-devtools.md)) inspects the read-model store.
  If it issues queries against collated columns without registering the matching collations against its own connection, they fail with `no such collation sequence`.
  Three resolutions to choose between:
  the panel imports the consumer's `collations` config (devtools already loads the same `CqrsConfig` for schema introspection), the panel lazy-registers on first `no such collation sequence` error, or its inspection layer is restricted to columns without custom collations.
  Current lean: the import path, but no devtools work has driven the question yet.

- **Comparator performance benchmarking.**
  The cost figures cited in design discussion are first-principles estimates (~3μs per comparison crossing the WASM↔JS boundary; ~30ms for 1K-row unindexed sort; negligible per-write at index-time).
  None of them are validated against a representative dataset (10K rows, mixed Latin/Cyrillic, realistic name lengths).
  Worth benchmarking before any consumer leans on the unindexed-sort path at scale.

- **Runtime fingerprint check for the determinism contract.**
  The requirement makes comparator behavior immutable for the database's lifetime ([`§16.7`](../intent/requirements/0016-custom-collations.md#167-determinism-contract)) — drift produces silent index corruption.
  Today the contract is documentation-only.
  A registry-side fingerprint (e.g. hash of `{ name, collator.resolvedOptions() }` stored alongside the registration and compared at open) would surface accidental drift at startup with a clear error.
  Cheap to add; no consumer has needed it yet.
