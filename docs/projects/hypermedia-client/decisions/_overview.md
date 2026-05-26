# decisions/ (hypermedia-client)

Architectural Decision Records (ADRs) scoped to `@cqrs-toolkit/hypermedia-client`.

ADRs follow the repo-wide [ADR lifecycle](../../../map.md) (Proposed → Accepted, immutable post-acceptance) and the Consequences shape (Implementation impact / Operational implications / Coding implications).

## Entries

- [ADR-0001 — `createCollection` library-wires `fetchSeedRecords`](0001-create-collection-seed-records-wiring.md) — adds `fetchTemplateVariables` and forwards `revisionPath` so `createCollection` library-wires the records seeding path against `representation.collection.template`, including toolkit-owned HAL/JSON envelope parsing.
- [ADR-0002 — `createCollection` is a contributor, not a whole-Collection factory](0002-create-collection-contributor-shape.md) — drops every pass-through option, returns only the representation-derived fetchers + forwarded `revisionPath`, and reshapes consumer call sites to assemble the `Collection` literal directly. Decouples the helper from `Collection`'s evolution.
- [ADR-0003 — Schema → TS codegen with `idReferences` and `AggregateRegistry`](0003-codegen-id-references.md) — `pull` runs a bundle → compile → AST-classify → assemble pipeline producing `cqrs/{commands,reps,shared}/types.ts`. Per-entry `idReferences` in the consumer config drive both codegen typing (`EntityId` / `Link` / `ServiceLink` on annotated fields) and runtime collection wiring (via `getGeneratedIdReferences` + `AggregateRegistry`). Compiler library is behind a swappable adapter.
