# 0009 — Query Manager — Change log

Log of substantive changes to [`0009-query-manager.md`](0009-query-manager.md).
Newest entries at the top; dates in ISO `YYYY-MM-DD`.

---

## 2026-05-07 — Refine §9.1 / §9.3 / §9.4 / §9.5 to match implementation

**Reason.** Several refinements:

1. **§9.1 / §9.3 "read-only" framing was too broad.** The Query Manager IS read-only with respect to read-model data — that mutation is the Sync Manager's job via the Event Processors. But pull queries do acquire cache keys, register holds, and emit lifecycle events as side effects (with `getLocallyById` as the side-effect-free alternative). The blanket "read-only and never mutates state" claim hid this; refined to "read-only with respect to read-model data" with explicit acknowledgment of cache-key lifecycle side effects.
2. **§9.4 was pull-only.** The original "all Query Manager APIs are pull-based" framing was a holdover from the library's first incarnation, when it was app-specific and Redux drove reactivity externally. When the library went standalone it absorbed the full reactivity lifecycle and added push (`watchById`, `watchCollection`) alongside pull. Both patterns are now first-class and combine naturally — re-running a pull query in response to a push event is the standard pattern for reactive UI.
3. **§9.5 method roster was incomplete.** The original spec listed only `getById`, `list`, and an optional `join`. Implementation has refined this into a richer surface: `getById` plus `getByIds`, `list`, `getLocallyById` (side-effect-free local read), `exists`, `count`, `watchById` and `watchCollection` (Observable streams), and cache-key lifecycle delegates (`touch`, `hold`, `release`, `releaseAll`).
4. **§9.5 return types refined.** Single-record lookup returns a structured `QueryResult<TLink, T>` with `data: T | undefined`, a `hasLocalChanges` flag, and `ItemMeta` (identity / change-detection metadata: `id`, `updatedAt`, `clientId?`, `revision?`). `clientId` carries the temp-ID identity tracking from [`0014 §14.4`](0014-entity-ref.md#144-id-strategy). List returns a similarly-structured `ListQueryResult<TLink, T>` with parallel data + metadata, `total`, `hasLocalChanges`, and the resolved `cacheKey`.
5. **`null` → `undefined`.** The original spec used `T | null` for not-found. The "prefer undefined over null" rule established in [`/docs/decisions/0004-prefer-undefined-over-null.md`](../../../../decisions/0004-prefer-undefined-over-null.md) supersedes this; updated to `T | undefined` throughout.
6. **§9.5.3 cross-collection joins reframed without status hedging.** Original spec sketched an optional `join<T>({ baseCollection, joinCollection, on, filter? })`. The intent is still there — joins are needed for real applications — but the realized shape is pending; the most likely approach is a dual-mode-aware escape hatch where the consumer provides both an in-memory implementation and a SQL query, with the library dispatching based on the active `IStorage`. The §9.5.3 entry now describes the intent and the dual-backend consideration without committing to a specific shape.
7. **Metadata surfacing flexibility.** `ItemMeta` may be surfaced as a standalone field (`meta` parallel to `data`) or embedded into items, whichever proves more practical. Future refactors are free to change the shape as long as the intent of providing per-item metadata is fulfilled. Both §9.5.1 and §9.5.2 carry this framing.

§9.6 (`getCollectionMeta`) is intentionally left as-is. Whether to add this synchronous metadata getter, or rely on the `watchCollection` observable signal stream for the same information, is a decision yet to be made; the doc and log will be updated when that determination lands.

**Changes.**

- §9.1 — refined "read-only and never mutates state" to "read-only with respect to read-model data" and added an explicit note that pull queries acquire cache keys, register holds, and emit events as side effects (with `getLocallyById` as the side-effect-free alternative).
- §9.3 — added "mutate read-model data" to the "does not" list (with attribution to the Sync Manager / Event Processors per [`0008`](0008-event-processors.md)).
- §9.4 — replaced "pull-only" framing (a holdover from the library's Redux-driven first incarnation) with a push/pull duality. Push via library-event subscriptions (or the typed Observable helpers `watchById` / `watchCollection`); pull via snapshot queries that read effective state from the local store. Higher-level primitives (e.g. Solid client) layer behaviors like "wait for seed completion" by combining pull with push.
- §9.5.1 Record lookup — refined return type from `Promise<T | null>` to `Promise<QueryResult<TLink, T>>` with `data: T | undefined`, `hasLocalChanges`, and `ItemMeta`. Added `getByIds` plural variant. Used `undefined` not `null` (per [ADR 0004](../../../../decisions/0004-prefer-undefined-over-null.md)). Metadata-shape framing: standalone or embedded, both fulfill intent.
- §9.5.2 Collection listing — kept the rich intent params shape (`filter?`, `sort?`, `limit?`, `cursor?`); refined the return type to `ListQueryResult<TLink, T>` with `data`, `total`, `hasLocalChanges`, `cacheKey`, plus `ItemMeta` per item (standalone or embedded — same flexibility note as §9.5.1).
- §9.5.3 Cross-collection joins — reframed as the intent (joins are needed for real applications) without status hedging; described the dual-mode-aware approach as one shape that fits both Mode A (in-memory) and worker modes (SQL).
- §9.5.4 NEW — Local snapshot lookup (`getLocallyById`).
- §9.5.5 NEW — Existence and count (`exists`, `count`).
- §9.5.6 NEW — Observable subscriptions (`watchById`, `watchCollection` with the `CollectionSignal` discriminated union).
- §9.5.7 NEW — Cache-key lifecycle delegates (`touch`, `hold`, `release`, `releaseAll`).
