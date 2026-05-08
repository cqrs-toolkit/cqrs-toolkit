# ADR 0004 (client) — Aggregates as a first-class concept on Collection

**Status:** Accepted 2026-04-22

## Context

Before this change, `Collection` and *aggregate* were conflated.
`getStreamId` lived directly on `Collection` and there was no explicit declaration of which fields in read-model data referenced which aggregates.
Two failure modes followed from the conflation:

1. **Reconciliation was hardcoded to `$.id`.**
   When a temporary tempId was reconciled to a server-assigned id, only the read model's own id field got patched.
   Cross-aggregate references in the same data — `notebookId` on a Note, `fileObjectId` inside an attachments array, Link objects pointing to other aggregates — had to be rewritten elsewhere or were silently left stale.
2. **A composite read model — one whose data spans events from more than one aggregate — could not be expressed.**
   `getStreamId` assumed a 1:1 mapping between Collection and one aggregate's stream identity, and there was no other place to declare additional aggregates whose IDs appear in the data.

A second, related failure was that several internal APIs that traffic in entity IDs were typed `string`, but the system had begun producing `EntityId = string | EntityRef` values.
EntityRef-shaped IDs were silently skipped or mishandled by `extractAggregateIdFromEvents`, `extractPayloadId`, and the read-model / query manager methods.

Both issues had to be resolved together because the new reconciliation path (see [ADR 0005](0005-reconcile-entry-point-split.md)) walks `idReferences` to patch all cross-aggregate references in one uniform pass — a flow that requires both the explicit aggregate declarations and EntityId-aware id extraction.

## Decision

**`Collection` requires an explicit `aggregate: AggregateConfig<TLink>`.**
The previously-top-level `getStreamId` is removed; callers use `collection.aggregate.getStreamId`.

**`Collection` accepts `idReferences: readonly IdReference<TLink>[]`** declaring every aggregate ID field that appears in the read-model data.
Two reference shapes:

- `DirectIdReference` — plain string ID at a JSONPath (e.g., `$.notebookId`, `$.attachments[*].fileObjectId`).
- `LinkIdReference` — Link object at a JSONPath; the consumer declares which aggregates the Link may target.

`IdReference` is a discriminated union (discriminant: `aggregate` vs `aggregates`).

**`resolveConfig` injects `{ aggregate: c.aggregate, path: '$.id' }` into every aggregate-bearing collection's `idReferences`** unless already present.
After resolution, every collection's `idReferences` contains its own self-id reference, so reconciliation is a uniform iteration with no special-case branch for the read model's own id.

**`patchEntityIds(data, oldId, newId, idReferences, reconciledAggregate)`** replaces the old `patchEntityId`.
For each `IdReference` whose declared aggregate matches the reconciled aggregate, it walks the path (with full JSONPath wildcard support via `findMatchingPaths`) and rewrites every leaf whose `entityIdToString(value)` equals the old id.
References targeting other aggregates are intentionally skipped — they reconcile when their own aggregates reconcile.

**`EventProcessorRunner` receives a `collectionsByName: Map<string, Collection<TLink>>` map** built from the *resolved* config.
`reconcileAnticipatedCreate` looks up the tracked collection and `assert`s presence — a miss is a programming error, not a runtime fallback.

**EntityId-aware ID extraction:** `extractAggregateIdFromEvents`, `extractPayloadId`, `ReadModelStore` methods (`getById`, `getByIds`, `exists`, `clearLocalChanges`, `setClientMetadata`, `delete`), `ProcessorResult.id`, `ProcessorContext.getCurrentState`, and `QueryManager` `GetById*` types accept `EntityId` and resolve to string via `entityIdToString` at the boundary with storage.

**`isEntityIdLink(value)` type guard** distinguishes a local Link (whose `id` may be `EntityId`) from the server-side `Link` from `@meticoeus/ddd-es` (whose `id` is `string`).
Used inside `patchEntityIds` for the `LinkIdReference` branch's runtime check.

**`AggregateConfig.getStreamId` is required, never undefined.**
Defensive `if (collection?.aggregate.getStreamId)` and `if (!collection.aggregate.getStreamId) continue` checks in `SyncManager` and `GapRepairCoordinator` are removed as dead branches.

## Consequences

**Easier:**
- Reconciliation patches all cross-aggregate references in one pass.
  A Note carrying `notebookId`, an `attachments[*].fileObjectId` array, and a self-id all converge through the same `patchEntityIds` walk.
- A future `CompositeCollection` — one collection assembled from events of multiple aggregates — has a clean home.
  `idReferences` is the only declaration of which aggregate IDs appear in the data; `Collection` keeps a 1:1 `aggregate` field, and `CompositeCollection` becomes a separate type with multiple aggregates and a per-aggregate revision map.
- EntityRef IDs flow through internal APIs without silent skips.
  Anticipated-event data carrying `EntityRef` at id positions is read via `entityIdToString` and replaced with confirmed server IDs on reconciliation.
- The injected `$.id` reference removes the self-ID special case from `patchEntityIds` — all references are uniform.

**Harder:**
- Consumers must declare `aggregate` on every Collection and `idReferences` for cross-aggregate fields.
  Demo collections gained both fields; existing consumers will need to add them when migrating.
  `injectCollectionDefaults` adds `$.id` automatically — consumers do *not* declare it themselves.
- The `LinkIdReference` branch needs both a static check (does the declared `aggregates` list include the reconciled one?) and a runtime check (does the actual `Link.type` at this path match?).
  The static-and-runtime split is a real distinction — sibling types in a Link union can carry different aggregate identities at different array elements.
- The dead-code cleanup in `SyncManager` and `GapRepairCoordinator` means the `aggregate.getStreamId` invariant is now load-bearing; a future change that re-introduces optionality breaks the inferred behavior.

## Notes

`parentRef` on command handler registrations was left alone in this change.
Once `entityRefPaths` becomes `IdReference[]` in a follow-up, `parentRef` likely gets subsumed — `IdReference` identifies by aggregate, which is more fundamental than `parentRef`'s identification by originating command type.
That is a separate decision.

The companion EntityId-broadening across read model store / query manager / processor types was done in the same shipped change.
It is mechanical (string → EntityId at boundaries; resolve via `entityIdToString` before the storage call) and is captured here rather than as a separate ADR because the broadening only matters in service of the reconciliation walk this ADR introduces.

## Related

- [ADR 0005 (client)](0005-reconcile-entry-point-split.md) — Reconcile entry-point split (`reconcileFromWsEvents` / `reconcileFromSnapshot`) — the reconciliation flow that consumes the `idReferences` declarations.
- [ADR 0003 (client)](0003-server-data-pipeline-rewrite.md) — Server data pipeline rewrite. This ADR is one slice of that umbrella rewrite; aggregates-as-first-class is the slice that closes the duplicated-id-handling structural problem [ADR 0003](0003-server-data-pipeline-rewrite.md) enumerates.

### Naming reconciliation for current readers

The Decision section names a few functions/classes that reflect the iteration-period view at the time of acceptance (this work was a multi-week rework with iterated naming).
The decision itself — explicit `aggregate` on `Collection`, `idReferences` declaring cross-aggregate fields, uniform `IdReference`-driven id walk — landed and stands; the names it cites diverged.
For present-day readers:

- **`patchEntityIds(data, oldId, newId, idReferences, reconciledAggregate)`** was the planned name; it never appears in any commit.
  The landed equivalent is split across:
  - `resolveCommandIds` (`packages/client/src/core/entity-ref/resolve-command-ids.ts`) — rewrites the command surface, mapping-store-driven rather than `(oldId, newId)`-driven.
  - `reconcileAggregateIds` (private method on `CommandQueue`) — extracts `{clientId, serverId, aggregate}` candidates from the server response and persists the mapping.
  - `applyIdRewritesToLocalOverlay` (private method on `CommandQueue`) — applies the resulting id map to read-model rows via `ReadModelStore.migrateEntityIds`.

  The conceptual shape (`IdReference[]`-walked id replacement; references targeting other aggregates skipped to reconcile when their own aggregates do) is what landed; the single-function signature in the Decision section is iteration-time framing, not current API.
- **`reconcileAnticipatedCreate`** existed in the ADR-shipping commit (`707b14b`, 2026-04-22) and was removed shortly after.
  The collection-lookup-and-assert behavior the ADR describes now lives inside the post-rework anticipated-event path; the name no longer matches anything in the tree.
- **`EventProcessorRunner`** existed at acceptance and was removed on 2026-04-27 (commit `84dc12f`) during a server-data-processing rewrite.
  Its responsibilities now live across `SyncManager` (pipeline orchestration) and `EventProcessorRegistry` (processor lookup).
  The `collectionsByName` map the ADR describes is still the right shape; it's just plumbed through the post-rework pipeline rather than into a `Runner` class.

Context references in this ADR (`extractPayloadId` etc.) describe the *prior* state that motivated the decision and are not affected by the renaming.
