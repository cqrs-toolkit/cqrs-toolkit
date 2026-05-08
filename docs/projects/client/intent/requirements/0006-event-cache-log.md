# 0006 — Event Cache — Change log

Log of substantive changes to [`0006-event-cache.md`](0006-event-cache.md).
Newest entries at the top; dates in ISO `YYYY-MM-DD`.

---

## 2026-05-07 — Refine §6.3.1 / §6.5 to match implementation

**Reason.** Two refinements:

1. **§6.3.1 anticipated event payload shape** carried the same pre-EntityRef framing that was corrected in [`0002 §2.2.2`](0002-domain-layer.md#222-anticipated-event-production) and [`0004 §4.7`](0004-command-queue.md#47-anticipated-event-handling). Anticipated events may carry `EntityRef` values in fields referencing locally-created entities; server-originated events always carry plain strings. The intent expression needed the same qualification.
2. **§6.5 storage model expressed events as a per-class variant shape** (Anticipated has commandId, Permanent has position/streamId/revision/eventId, etc.) with single-cacheKey attribution. Implementation refined this into a single unified `CachedEventRecord` with nullable fields by persistence type, multi-cacheKey attribution (junction table in SQL, array in memory), and BigInt-as-string serialization for `position` / `revision`. The `event: object` wrapper became flat fields (`type`, `streamId`, `data` as JSON-serialized string); `receivedAt` was renamed to `createdAt`; a new `processedAt: number | null` tracks read-model application state.

**Changes.**

- §6.3.1 — applied the same EntityRef-qualification used in [`0002 §2.2.2`](0002-domain-layer.md#222-anticipated-event-production) and [`0004 §4.7`](0004-command-queue.md#47-anticipated-event-handling) to the anticipated-event payload-shape bullet.
- §6.5 — rewrote the storage model to match the `CachedEventRecord` shape implementation settled on. Restructured into Common / Permanent-specific / Anticipated-specific groups. Replaced single-cacheKey attribution with multi-cacheKey (`cacheKeys: string[]`). Updated `revision: number` to `revision: string | null` (BigInt-as-string). Replaced `event: object` with flat fields. Renamed `receivedAt` → `createdAt`; added `processedAt`.
