# 0002 — Domain Layer — Change log

Log of substantive changes to [`0002-domain-layer.md`](0002-domain-layer.md).
Newest entries at the top; dates in ISO `YYYY-MM-DD`.

---

## 2026-05-08 — Reshape handler outcome as a flat algebraic union; widen `validateAsync` for conflicts **(DRAFT — Part 3 in progress)**

**Status.** Draft. Reflects Part 3's implementation as of the latest landed slice (handler outcome reshape + handler-returned conflict routing). The category enum and mapping API live in [`0004 §4.8`](0004-command-queue.md#48-retry-and-failure-handling).

**Reason.** §2.4 previously described the handler's output as `{ anticipatedEvents, postProcessPlan? }`, with the implementation returning that wrapped in `Result<T, E>` and the error union expanding over time. Part 3 introduces a `'conflict'` outcome (handler signals a state conflict it detected via `{ initial, current }`) — adding it to the existing error union flattens its semantics, since a _pipeline-time_ conflict has a lifecycle distinct from a validation rejection (which fails the enqueue and isn't persisted). Lumping all non-success cases under a single `Err` branch obscures the distinction.

The handler boundary is reshaped as a flat discriminated union — `'success' | 'validation-error' | 'unknown-command' | 'conflict'` — so each outcome reads as a peer rather than a nested error case. `validate` keeps its narrow `Result<unknown, ValidationException>` (sync, no read-model access). `validateAsync` widens its return to `Result<unknown, ValidationException | ConflictException>` because it has `queryManager` access and is a natural place to detect conflicts ("another entity already has this name"). Submit-time conflicts (handler first call OR validateAsync) and validation errors flow through the same `Err` path on `submit()` — the consumer discriminates via the exception type if they care.

**Changes.**

- §2.4 — added an "Outcome shape — flat algebraic union" subsection enumerating the four variants. The `'conflict'` description now spells out **submit-time vs pipeline-time** routing and points at [`0004 §4.8.3`](0004-command-queue.md#483-pluggable-failure-mapping) for the runtime detail. The `validate`/`validateAsync` paragraph now explicitly notes that `validateAsync` widens to `Result<unknown, ValidationException | ConflictException>` while `validate` stays narrow. Determinism note refers to "outcome" rather than "events" to reflect the wider output space.

**Scope notes.**

- The category enum and pluggable mapping API live in [`0004 §4.8`](0004-command-queue.md#48-retry-and-failure-handling); §2.4's reference points there for the runtime taxonomy.
- No change to event processors ([`0008`](0008-event-processors.md)) — the algebraic outcome applies only to command-level handlers.

---

## 2026-05-08 — Surface `currentState` in the conceptual contract; document `HandlerState` discriminated union

**Reason.** The §2.4 conceptual contract (`execute(command) -> { events, postProcess? }`) abstracted away the read-model snapshot the consumer passes at submit. This was accurate to the no-state-input pre-history but is now load-bearing: the Command Queue persists the snapshot ([`0004 §4.4.2`](0004-command-queue.md#442-submit-time-inputs)), and surfaces it back to handlers via a discriminated-union `HandlerState` so a handler can compare "what the user saw at submit" vs "what's there now." The conceptual contract should make the snapshot a visible part of the surface — both to set the expectation that the consumer is invited to pass current read-model state at submit time, and to document the regenerate shape downstream specs reference.

**Changes.**

- §2.4 — extended the conceptual contract from `execute(command)` to `execute(command, currentState?)`, with `currentState` documented as the consumer-provided read-model snapshot the user was operating against at submit. Documented the discriminated-union `HandlerState` shape: `{ mode: 'initial', initial }` on first call, `{ mode: 'regenerate', initial, current }` on every subsequent invocation regardless of trigger (server-event delta, id-rewrite cascade, AutoRevision resolution). Cross-references [`0004 §4.4.2`](0004-command-queue.md#442-submit-time-inputs) for the runtime construction. Called out that this shape applies to command-level functions only — Event Processors ([`0008`](0008-event-processors.md)) are entity-level reducers and their `state` argument stays unchanged. Reaffirmed determinism with explicit acknowledgement that determinism is over `(command, state)` together.

**Scope notes.**

- This change captures the _data shape_ a handler sees. The lifecycle/exception side (new `'needs-review'` status, typed `ConflictException` family, soft-skip behavior for dependents) is deferred to a later requirement update aligned with Part 3b of the implementation plan.
- No change to [`0008`](0008-event-processors.md) — Event Processors stay at `state: TModel | undefined`.

---

## 2026-05-07 — Reconcile with EntityRef formalization ([0014](0014-entity-ref.md))

**Reason.** 0002 predates [0014](0014-entity-ref.md); its claims about anticipated event payload shape and "temporary ID replacement" assume the pre-EntityRef-formalization model where temp-ID handling was generic post-processing. [0014](0014-entity-ref.md) formalized the EntityRef lifecycle (`idStrategy` temporary/permanent, opaque entity refs in handler input, structured reconciliation), so 0002's contract framing needed to acknowledge this.

**Changes.**

- §2.2.2 — qualified "match server event payload shape" claim: anticipated events may carry `EntityRef` in fields referencing locally-created entities where server events carry plain strings. Wording uses "entities," not "parents," to reflect that the `entityRefPaths` machinery in [`0014 §14.5.2`](0014-entity-ref.md#1452-command-submission-entityref-extraction-point) supports `EntityRef` values at arbitrary nested and array paths, not only parent positions.
- §1.2.3 — replaced "temp ID replacement" example with a more accurate "entity ID reconciliation" pointer to [0014](0014-entity-ref.md).
- §1.2.4 — renamed "Temporary identifiers" → "Entity identifiers"; rewrote to cover both `idStrategy` cases (temporary and permanent), the `createEntityId(context)` helper, and the contract that entity reference IDs are opaque to the Domain Layer (may arrive as plain string or `EntityRef`).
