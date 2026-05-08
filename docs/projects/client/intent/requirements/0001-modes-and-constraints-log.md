# 0001 — Modes and Constraints — Change log

Log of substantive changes to [`0001-modes-and-constraints.md`](0001-modes-and-constraints.md).
Newest entries at the top; dates in ISO `YYYY-MM-DD`.

---

## 2026-05-07 — Hoist EntityRef boundary into cross-component invariants

**Reason.** Requirement [0014 §14.5.1](0014-entity-ref.md#1451-entityref-in-anticipated-events) defines: "Server events always produce plain string IDs. `EntityRef` must never appear in server-seeded read model data." That constraint applies across event-cache, read-model-store, and sync-manager, so its canonical home is 0001's §1.3 "Cross-component invariants" list — not only in [0014](0014-entity-ref.md).

**Change.** Added bullet to §1.3:

> **EntityRef boundary.** `EntityRef` is a client-side anticipated-event-only construct. Server-originated events and snapshots must always carry plain string IDs; `EntityRef` must not appear in server-seeded read model data.

---

## 2026-05-07 — Fold cross-cutting principles from deleted 0012 into §1.3

**Reason.** `0012-open-ambiguities.md` ([retired during the castle migration](../../evolution/_overview.md#2026-05-04--castle-migration-requirements-wing-with-renumbering-and-content-restructure)) was misclassified as a requirement — it was actually a mix of speculative open items (which belong in `explorations/`), already-resolved items (whose content lives in the relevant requirements), historical "removed ambiguities" metadata, and a §11.9 "Guiding principles for future extensions" section that *was* normative cross-cutting intent. As part of restructuring 0012, the §11.9 principles were folded into §1.3 since they sit at the same level as the existing cross-component invariants.

The "pull-based UI data access" principle from §11.9 was replaced with "first-class push and pull" to reflect the push/pull duality clarified in [`0009 §9.4`](0009-query-manager.md#94-query-model) / [`0010 §10.1`](0010-public-api.md#101-design-principles). The other §11.9 principles (single-session isolation, offline-first correctness) were carried over directly; "deterministic recovery" already existed in §1.3 (no duplicate added); "eviction safety" overlap was absorbed by the existing "Cache key ownership" bullet.

**Changes.**

- Added three bullets to §1.3:
  - **Single-session isolation** — all persisted client state belongs to one user session; user changes trigger a full wipe.
  - **Offline-first correctness** — the library must function offline / unauthenticated; reconnection produces eventual consistency.
  - **First-class push and pull** — both snapshot queries and event subscriptions are equally supported as consumption patterns.
