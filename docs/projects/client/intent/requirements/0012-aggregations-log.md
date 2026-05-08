# 0012 — Client-Side Aggregations — Change log

Log of substantive changes to [`0012-aggregations.md`](0012-aggregations.md).
Newest entries at the top; dates in ISO `YYYY-MM-DD`.

---

## 2026-05-07 — Refine §12.13 push/pull framing

**Reason.** §12.13 said "Queries are pull-based. Consumers subscribe to `AggregationUpdated` events as invalidation signals and re-query to obtain updated values." Same Redux holdover seen in [`0009 §9.4`](0009-query-manager.md#94-query-model) / [`0010 §10.1`](0010-public-api.md#101-design-principles) — push and pull are both first-class consumption patterns now. The aggregation Query Manager surface follows the same duality as the rest of the Query Manager.

**Changes.**

- §12.13 — replaced "pull-based" framing with the push/pull duality established in [`0009 §9.4`](0009-query-manager.md#94-query-model). Consumers can re-query for snapshot values, subscribe to `AggregationUpdated` for invalidation signals, or combine both.
