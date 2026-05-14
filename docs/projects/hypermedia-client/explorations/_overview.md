# explorations/ (hypermedia-client)

Design alternatives under evaluation; questions to investigate before they become committed scope (a requirement) or a settled choice (an ADR).
Mutable — entries are edited as understanding develops, then resolve up into another wing or are dropped.

## Distinguished from neighbours

- **vs `intent/requirements/`** (not yet present in this castle): requirements describe _what the project commits to building_; explorations describe _what we're considering_. An exploration that the project commits to becomes a requirement.
- **vs `decisions/`** (not yet present in this castle): ADRs are settled choices with rationale; explorations are open questions with candidate answers. An exploration that resolves into a chosen approach spawns an ADR.

## Naming

Descriptive slugs (`<topic>.md`); no `NNNN-` prefix. Explorations are mutable and can be deleted, so monotonic numbering would be churn for no benefit.

## Lifecycle

See the [client castle's explorations wing](../../client/explorations/_overview.md#lifecycle) for the canonical lifecycle description — it applies here unchanged.

## Entries

- [`createCollection-seed-records-wiring.md`](createCollection-seed-records-wiring.md) — resolved 2026-05-12; codified in [ADR-0001](../decisions/0001-create-collection-seed-records-wiring.md). Adds `fetchTemplateVariables` and forwards `revisionPath` so `createCollection` library-wires `fetchSeedRecords` against `representation.collection.template`. Kept on file for the alternatives discussion.
- [`hal-link-stripping.md`](hal-link-stripping.md) — open. Should the recursive HAL `_links` strip in the records parser be configurable? No driver yet; current default is "strip recursively." Revisit when a consumer needs `_links` in the read model.
