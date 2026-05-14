# 0014 — EntityRef — Change log

Log of substantive changes to [`0014-entity-ref.md`](0014-entity-ref.md).
Newest entries at the top; dates in ISO `YYYY-MM-DD`.

---

## 2026-05-11 — Tag EntityRef-derived `dependsOn` entries with `source: 'entity-ref'` **(DRAFT — ADR 0009 Proposed)**

**Status.** Draft. Tracks [ADR-0009](../../decisions/0009-hard-soft-dependency-classification.md).

**Reason.** `CommandRecord.dependsOn` is now source-tagged (`CommandDependency[]`). The hard/soft cascade rule short-circuits to hard for EntityRef-derived edges by reading the `source` tag — the spec needs to surface where that tag is set.

**Changes.**

- §14.6.1 — added a sentence to the automatic-`dependsOn` paragraph stating that EntityRef-derived entries carry `source: 'entity-ref'` (with cross-reference to [`0004 §4.4`](0004-command-queue.md#44-command-record-schema) and [`§4.6.1`](0004-command-queue.md#461-dependencies)), and that this short-circuits the cascade walk to hard.

---

## 2026-05-07 — Refine type and helper names to match implementation

**Reason.** The original spec used names that implementation refined into different concrete identifiers as the EntityRef machinery landed:

| Spec                                    | Code                             |
| --------------------------------------- | -------------------------------- |
| `ID` (type alias)                       | `EntityId`                       |
| `idToString(id: ID)` helper             | `entityIdToString(id: EntityId)` |
| `entityRefData` field on command record | `commandIdPaths`                 |
| `result.value.created` (submit result)  | `result.value.entityRef`         |

Plus the `EntityRef` interface gained `readonly` modifiers on all fields, and the `entityId` JSDoc was simplified ("client-generated") since `idStrategy` distinguishes temporary vs permanent.

**Changes.**

- §14.2 — renamed type alias `ID` → `EntityId`. Renamed helper `idToString` → `entityIdToString`. Added `readonly` modifiers to `EntityRef` interface fields. Updated example interfaces (Notebook, Note) to use `EntityId`.
- §14.5.2 — replaced `entityRefData` references with `commandIdPaths` throughout the command-submission flow (steps 1-7, the diagram, and the dedicated subsection).
- §14.5.2 subsection title — `entityRefData` → `commandIdPaths`.
- §14.5.2.1 — `entityRefData` reference in the JSONPath operators table updated to `commandIdPaths`.
- §14.5.4 — `result.value.created` → `result.value.entityRef`.
- §14.6.1 — `entityRefData` reference updated to `commandIdPaths`.
- §14.7 — `encodeIdParam` / `decodeIdParam` signatures: `id: ID` → `id: EntityId`. (The helpers themselves don't yet exist in code; the type-name alignment is for forward consistency.)
- §14.8.1 — section heading and content: `idToString(id: ID)` → `entityIdToString(id: EntityId)`.
- §14.10.1 — Solid integration code reference: `idToString` → `entityIdToString`.
- §14.11 — hypermedia-client integration: `entityRefData` reference updated to `commandIdPaths`.

---

## 2026-05-07 — Refine §14.5.2.1 path-declaration surfaces

**Reason.** The original spec described `entityRefPaths: string[]` as a flat array on command handler registration. Implementation refined this in two directions: handler registrations carry `commandIdReferences: IdReference<TLink>[]` (paths paired with aggregate config — see [`0015 §15.2.2`](0015-aggregate-config.md#1522-idreference)), while `entityRefPaths` (the simpler flat-string-array form) does land on `ScopeCacheKeyTemplate` for cache keys with EntityRef-bearing scope params. The JSONPath subset rules apply to both surfaces.

**Changes.**

- §14.5.2.1 — kept the JSONPath subset operators table. Replaced the single-surface "`entityRefPaths` on a command handler registration" framing with a two-surface description: handler registrations use `commandIdReferences` (richer form, pairs paths with aggregate configs); cache key templates use `entityRefPaths` (string array, sufficient for cache-key context). Cross-references [`0015 §15.2.2`](0015-aggregate-config.md#1522-idreference) for the `IdReference` shape.
