# decisions/ (hypermedia-client)

Architectural Decision Records (ADRs) scoped to `@cqrs-toolkit/hypermedia-client`.

ADRs follow the repo-wide [ADR lifecycle](../../../map.md) (Proposed → Accepted, immutable post-acceptance) and the Consequences shape (Implementation impact / Operational implications / Coding implications).

## Entries

- [ADR-0001 — `createCollection` library-wires `fetchSeedRecords`](0001-create-collection-seed-records-wiring.md) — adds `fetchTemplateVariables` and forwards `revisionPath` so `createCollection` library-wires the records seeding path against `representation.collection.template`, including toolkit-owned HAL/JSON envelope parsing.
