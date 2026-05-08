# 0002 — Domain Layer — Change log

Log of substantive changes to [`0002-domain-layer.md`](0002-domain-layer.md).
Newest entries at the top; dates in ISO `YYYY-MM-DD`.

---

## 2026-05-07 — Reconcile with EntityRef formalization ([0014](0014-entity-ref.md))

**Reason.** 0002 predates [0014](0014-entity-ref.md); its claims about anticipated event payload shape and "temporary ID replacement" assume the pre-EntityRef-formalization model where temp-ID handling was generic post-processing. [0014](0014-entity-ref.md) formalized the EntityRef lifecycle (`idStrategy` temporary/permanent, opaque entity refs in handler input, structured reconciliation), so 0002's contract framing needed to acknowledge this.

**Changes.**

- §2.2.2 — qualified "match server event payload shape" claim: anticipated events may carry `EntityRef` in fields referencing locally-created entities where server events carry plain strings. Wording uses "entities," not "parents," to reflect that the `entityRefPaths` machinery in [`0014 §14.5.2`](0014-entity-ref.md#1452-command-submission-entityref-extraction-point) supports `EntityRef` values at arbitrary nested and array paths, not only parent positions.
- §1.2.3 — replaced "temp ID replacement" example with a more accurate "entity ID reconciliation" pointer to [0014](0014-entity-ref.md).
- §1.2.4 — renamed "Temporary identifiers" → "Entity identifiers"; rewrote to cover both `idStrategy` cases (temporary and permanent), the `createEntityId(context)` helper, and the contract that entity reference IDs are opaque to the Domain Layer (may arrive as plain string or `EntityRef`).
