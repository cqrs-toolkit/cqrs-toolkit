# 0008 — Event Processors — Change log

Log of substantive changes to [`0008-event-processors.md`](0008-event-processors.md).
Newest entries at the top; dates in ISO `YYYY-MM-DD`.

---

## 2026-05-07 — Refine §8.3 / §8.4.2 / §8.6 to match implementation

**Reason.** Three refinements:

1. **§8.3 processor interface refined.** Intent expressed three named methods (`reduceServer`, `reduceAnticipated`, `reduceStateful`) returning `{ op: 'upsert' / 'delete' / 'none', modified, value }`. Implementation refined this into a single unified function `(event, state, context) => ProcessorReturn`, with `context.persistence` discriminating server / anticipated / stateful. Return is a single `ProcessorResult`, an array of results (multi-update — one event may legitimately touch several collections), an `InvalidateSignal`, or `undefined`. `ProcessorResult` carries `{ collection, id, update, isServerUpdate }`; `UpdateOperation` is `{ type: 'set' | 'merge' | 'delete' }` (mirrors [`0007 §7.5`](0007-read-model-store.md#75-deletes-and-update-operations)). Registration is `ProcessorRegistration { eventTypes, processor, persistenceTypes? }`.
2. **§8.4.2 conflated processor output with storage layout.** The intent text described processors directly populating `server` / `data` fields; implementation refined this into the processor returning ops and the Read Model Store handling baseline/overlay storage. Field names in the storage layer are `serverData` / `effectiveData` (per [`0007 §7.4`](0007-read-model-store.md#74-server-baseline-vs-effective-overlay-semantics)); `_clientMetadata` carries the temp-ID identity tracking that the section's anticipated-creation flow now produces.
3. **§8.6 reflected the original manual-declaration model for `dependsOn`.** Original intent required consumers to declare `dependsOn` for entity references. Implementation has since refined this into auto-wiring from `EntityRef.commandId` values (per [`0014 §14.6.1`](0014-entity-ref.md#1461-automatic-dependson)) — a recent design decision that's expected to make explicit declarations unnecessary for entity references. The auto-wiring may need refinement if real cases surface that defeat it; explicit declarations remain the escape hatch for non-EntityRef ordering constraints.

**Changes.**

- §8.3 — replaced the three-method interface and `op`/`modified`/`value` result framing with the unified processor function (`(event, state, context) => ProcessorReturn`), `ProcessorContext` shape, `ProcessorReturn` variants (single result / array / invalidate / undefined), `ProcessorResult { collection, id, update, isServerUpdate }`, and `ProcessorRegistration { eventTypes, processor, persistenceTypes? }`. Cross-references [`0007 §7.5`](0007-read-model-store.md#75-deletes-and-update-operations) for `UpdateOperation`. The `collection` bullet captures that a single processor invocation can return multiple `ProcessorResult`s targeting different collections (one event → multiple collections via array return).
- §8.4.2 — reframed the anticipated-creation flow as "processor returns a `set` op with `isServerUpdate: false`; the Read Model Store handles baseline/overlay storage per [`0007 §7.4`](0007-read-model-store.md#74-server-baseline-vs-effective-overlay-semantics)". Added a pointer to `_clientMetadata` and [`0014 §14.4`](0014-entity-ref.md#144-id-strategy) for temp-ID identity tracking. Updated the `dependsOn` paragraph to acknowledge the shift from manual declaration to EntityRef-driven auto-wiring.
- §8.6 — added the auto-wiring acknowledgment to the `dependsOn` framing, with a cross-reference to [`0004 §4.6.1`](0004-command-queue.md#461-dependencies).
