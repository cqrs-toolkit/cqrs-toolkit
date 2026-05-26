# ADR 0010 (client) — Consumer-registered JS comparators for custom SQLite collations

**Status:** Accepted (2026-05-22)

## Context

[`0016 §16`](../intent/requirements/0016-custom-collations.md) specifies the custom-collation surface: `CqrsConfig.collations` carries `{ name, compare }` entries; `loadAndOpenDb` registers each one against the opened WASM SQLite connection via `sqlite3.capi.sqlite3_create_collation_v2`; the same `compare` drives the JS-side sort in Mode A through `SortResolverLookup`; backends that can't register comparators take an `unsupportedCollations: 'error' | 'degrade'` policy.

The driving requirement is locale-aware ordering of mirrored backend text (e.g. notebook names) — SQLite's built-in `BINARY`/`NOCASE`/`RTRIM` collations don't sort non-ASCII correctly and can't express preferred-then-fallback per-locale columns.
Several alternatives that satisfy "locale-aware ordering" were considered and rejected.
This ADR records the load-bearing ones — the framing-shaping rejections, not every variant.

## Decision

Custom collations are consumer-supplied JS comparators registered per-connection against the WASM SQLite engine via `sqlite3_create_collation_v2`.
The library does not ship a built-in collation set, does not bundle ICU, and does not require server cooperation.

## Consequences

### Implementation impact

The contract that landed is documented in [`0016 §16`](../intent/requirements/0016-custom-collations.md); the ADR adds rationale only.
No further code or schema work is required by this ADR — the rejections steer future design space, not current implementation.

### Operational implications

#### Gains

- Locale support is consumer-driven — register an `Intl.Collator(locale, options)` and reference it by name; no library release is needed to add a new locale.
- The runtime's bundled ICU (V8 / JavaScriptCore / SpiderMonkey) tracks platform updates without requiring this library to coordinate ICU versions.

#### Costs

- JS-comparator performance crosses the WASM↔JS boundary per comparison.
  Acceptable when sorts are index-backed (comparisons happen once at write time, none at query time); painful on unindexed sorts at scale.
  Mitigated by surfacing composite `(sort_col, id)` indexes in the requirement's examples ([`§16.8`](../intent/requirements/0016-custom-collations.md#168-schema-example)).
- Determinism is a consumer contract ([`§16.7`](../intent/requirements/0016-custom-collations.md#167-determinism-contract)).
  Bumping comparator behaviour requires `REINDEX` for every index that mentions the name; no runtime fingerprint check yet (deferred in [`locale-aware-sort.md`](../explorations/locale-aware-sort.md)).

### Coding implications

#### Gains

- The WASM-side mechanic is one helper call against a stable sqlite-wasm API — no custom WASM build pipeline, no extra binary size beyond a small `TextDecoder`-based adapter.
- Pre-release schema decisions are not constrained by an external collation library's release cadence.

#### Costs

- Backends without `sqlite3_create_collation_v2` exposed (better-sqlite3, `node:sqlite`) require a per-environment policy decision ([`§16.6`](../intent/requirements/0016-custom-collations.md#166-backends-without-sqlite3_create_collation_v2)).
  The two policy values (`'error'`, `'degrade'`) are the explicit cost-surface — consumers running the same `CqrsConfig` on a non-WASM backend must pick one.

## Alternatives considered

**ICU extension (custom WASM build with `SQLITE_ENABLE_ICU` + libicu).**
SQLite ships an official ICU collation extension that links libicu and provides locale-aware collations natively. Rejected because the default `@sqlite.org/sqlite-wasm` build does not include it: adopting it would require a custom WASM build pipeline, ship significantly more code (libicu adds hundreds of KB), and lock the project to a specific ICU version — coordinated upgrades, OPFS-quota pressure from the larger blob. JS `Intl.Collator` (backed by the runtime's bundled ICU — V8, JavaScriptCore, SpiderMonkey) covers the same correctness need with the runtime's own version-management story. The ~15 lines of JS that bridge a consumer comparator to `sqlite3_create_collation_v2` is a much smaller surface than a bundled-extension pipeline.

**Pre-folded ASCII sort keys.**
Store a `lower(strip-diacritics(...))` ASCII version as a normal `BINARY`-collated column and sort by it. Rejected because it works adequately for English but fails on any language with non-trivial collation rules: for Cyrillic the code-point order is close but not correct (`ё` sorts after `я` by code point but between `е` and `ж` lexically); digraphs and contextual rules in other scripts (Spanish `ll`, German `ß`, Czech `ch`) have no ASCII-fold preimage that matches lexical order. The shortcut would silently produce subtly-wrong ordering across consumer-visible columns — the kind of bug whose detection depends on a consumer noticing rather than a test catching it. The mechanism (a virtual column with a `BINARY`-collated expression) remains available to consumers who explicitly want this trade-off for a specific column; the library just doesn't bake it in as a default.

**Server-driven sort.**
Backend computes order and the client preserves it via a numeric `sort_position` column. Rejected because it doesn't compose with local-only filtering or any list params the server didn't precompute against, and it conflicts with the offline-first invariant in [`0001 §1`](../intent/requirements/0001-modes-and-constraints.md): local-first list pages need to sort independently — pagination, filter changes, and optimistic mutations all need to reorder without round-tripping to a server that may be unavailable. Tractable for read-only catalog pages with fixed sort; not viable as the general list-ordering mechanism the read-model store needs to support.

## Related

- Specifies the contract this ADR justifies: [`0016 §16 Custom Collations`](../intent/requirements/0016-custom-collations.md).
- Sourced from exploration: [`explorations/locale-aware-sort.md`](../explorations/locale-aware-sort.md). The exploration persists past this ADR's acceptance, trimmed to the items intentionally deferred past V1 (per-query overrides, devtools cooperation, comparator performance benchmarking, runtime fingerprint check).
- Backend-policy reference: [`@cqrs-toolkit/client-electron`](../../client-electron/_overview.md) opts into `unsupportedCollations: 'degrade'` for the better-sqlite3 path that this ADR's `node:sqlite` framing also covers.
- Repo-wide pre-release posture: [ADR-0001 (root) — Pre-release: no back-compat shims, breaking changes acceptable](../../../decisions/0001-pre-release-no-back-compat.md). The collation surface is shipped as a breaking shape change without a migration path.
