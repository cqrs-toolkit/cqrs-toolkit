# 0007 — Read Model Store — Change log

Log of substantive changes to [`0007-read-model-store.md`](0007-read-model-store.md).
Newest entries at the top; dates in ISO `YYYY-MM-DD`.

---

## 2026-05-07 — Refine §7.3 / §7.4 / §7.5 / §7.6 / §7.7 to match implementation

**Reason.** The data model and supporting sections needed multiple refinements as implementation settled the storage shape:

1. **§7.3 was a four-field sketch (`id`, `cacheKey`, `data`, `server?`).** Implementation refined this into a richer `ReadModelRecord` carrying `collection`, multi-cacheKey attribution (`cacheKeys: string[]`), JSON-serialized `serverData` / `effectiveData`, `hasLocalChanges`, `updatedAt`, BigInt-as-string `revision` / `position` for sync tracking, and `_clientMetadata` for EntityRef-driven temp-ID identity tracking ([0014](0014-entity-ref.md) territory). The intent fields map cleanly onto the implementation, but the spec needed updating to reflect the richer record.
2. **§7.4 baseline-storage rule** — intent is still to keep `serverData` only when an overlay is present (overlays are rare; on the high end ~1% of records carry one, so duplicating server state into a separate field doubles per-record storage for the common case — wasteful for an offline-capable client where quota is tight, and storage pressure is already a known concern on some platforms, notably iOS). Current implementation keeps `serverData` populated alongside `effectiveData` for code simplicity; this is a tolerated deviation, not the design preference. Doc now leads with the storage-quota-driven intent and explicitly notes the deviation as a priority-when-we-get-to-it cleanup, not a wait-for-evidence trigger.
3. **§7.5 update operations refined.** Intent specified `{ op: 'upsert', modified, value }`, `{ op: 'delete' }`, `{ op: 'none' }`. Implementation refined this into `UpdateOperation<T>` with discriminator `type` and operations `set` / `merge` / `delete` (no `'none'`); reducers wrap updates in `ProcessorResult<T>` with `isServerUpdate` flag; refetch signaling moved to a separate `InvalidateSignal { invalidate: true }`.
4. **§7.6 SQLite-only framing.** Generalized to acknowledge the `IStorage` abstraction — SQLite tables in worker modes, in-memory Maps in Mode A. Cross-references [`0001 §1.1`](0001-modes-and-constraints.md#11-supported-execution-modes).
5. **§7.7 cacheKey eviction filter** assumed single-key attribution. With multi-key attribution (`cacheKeys: string[]`), eviction is a junction-table operation: remove the evicted key from each record's array; delete the record only when its `cacheKeys` becomes empty.

**Changes.**

- §7.3 — rewrote the data model to match `ReadModelRecord`. Added `collection`, multi-cacheKey, BigInt-as-string `revision` / `position`, `hasLocalChanges`, `updatedAt`, `_clientMetadata` (with cross-reference to [`0014 §14.4`](0014-entity-ref.md#144-id-strategy)).
- §7.4 — leads with the storage-quota-driven intent (only keep `serverData` when an overlay exists) and explicitly notes that current implementation deviates by keeping `serverData` populated for code simplicity. Tolerated deviation, not the design preference; storage pressure is already known on some platforms (notably iOS), so revisiting is a priority-scheduling matter, not a wait-for-evidence trigger. Storage-rules-under-intent section follows.
- §7.5 — replaced the intent ops (`upsert` / `delete` / `none` with `modified` flag) with `UpdateOperation<T>` (`set` / `merge` / `delete`), `ProcessorResult<T>` (with `isServerUpdate`), and the separate `InvalidateSignal` for refetch triggers. Cross-references [`0005 §5.7`](0005-sync-manager.md#57-stateful-event-handling).
- §7.6 — generalized the SQLite-only framing to acknowledge the `IStorage` abstraction (SQLite tables in worker modes, in-memory Maps in Mode A).
- §7.7 — updated the eviction operation to a junction-table approach: remove the evicted key from each record's `cacheKeys` array; delete the record only when the array becomes empty.
