# 0015 — Aggregate Configuration — Change log

Log of substantive changes to [`0015-aggregate-config.md`](0015-aggregate-config.md).
Newest entries at the top; dates in ISO `YYYY-MM-DD`.

---

## 2026-05-07 — Drop §15.3.1 / §15.3.2 "current vs new" framing artefact

**Reason.** §15.3 was structured as "§15.3.1 Current behavior" (describing the pre-proposal state — inference from command-data shapes, `patchEntityId` in the EventProcessorRunner) and "§15.3.2 New behavior" (the proposed declarative-paths model). That structure was an artefact from when proposals lived inside specs because there was nowhere else for them. The castle now provides cleaner homes for that kind of content:

- Historical "what we did before" context belongs in [client ADR 0004 (aggregates-as-first-class)](../../decisions/0004-aggregates-as-first-class.md).
- The current intent belongs in the requirement, not split across before/after subsections.

The "New behavior" content also referenced `patchEntityId` — an iteration-time WIP name that didn't survive into implementation; the actual reconciliation flow is described in [`0004 §4.6.2`](0004-command-queue.md#462-post-processing) / [`§4.9`](0004-command-queue.md#49-reconciliation-with-server-results).

**Changes.**

- §15.3 — collapsed §15.3.1 / §15.3.2 into a single §15.3 body describing the current reconciliation flow. Removed the `patchEntityId` reference (artefact). Cross-references [`0004 §4.6.2`](0004-command-queue.md#462-post-processing) (reconciliation flow), [`0003 §3.2.4`](0003-cache-manager.md#324-entityref-driven-inputs-and-reconciliation) (cache key reconciliation), and [`0014 §14.6.1`](0014-entity-ref.md#1461-automatic-dependson) (auto-`dependsOn`). Pre-implementation behavior is no longer described in this requirement; [ADR 0004](../../decisions/0004-aggregates-as-first-class.md) carries that history.

---

## 2026-05-07 — Refine type definitions and example to match implementation

**Reason.** Three type-shape refinements landed during implementation that the original spec didn't yet reflect:

1. **§15.2.1 `AggregateConfig`** — original spec used a type alias `Omit<TLink, 'id'> & { getStreamId }`. Implementation chose an interface form with explicit `service` / `type` / `getStreamId` plus a `getLinkMatcher(): Omit<TLink, 'id'>` method. Plus a `ClientAggregate<TLink>` convenience class that computes `getLinkMatcher` automatically.
2. **§15.2.2 `IdReference`** — original spec defined a single shape `{ path, aggregate: string }`. Implementation refined this into a discriminated union — `DirectIdReference<TLink>` (`{ aggregate: AggregateConfig<TLink>, path }`) for paths pointing to plain string IDs, and `LinkIdReference<TLink>` (`{ aggregates: AggregateConfig<TLink>[], path }`) for paths pointing to `Link` objects (which carry their own type discriminator and may be union/polymorphic). `aggregate` is a full `AggregateConfig<TLink>`, not a string. Plus response-side `ResponseDirectIdReference` / `ResponseLinkIdReference` extend the above with `revisionPath?` for revision-tracking on the response side.
3. **§15.4 example** — the literal-object form `const x: AggregateConfig<ServiceLink> = { type, service, getStreamId }` is missing the required `getLinkMatcher` method. The idiomatic consumer form uses `new ClientAggregate({ ... })`, which computes `getLinkMatcher` automatically.

**Changes.**

- §15.2.1 — replaced the `Omit<TLink, 'id'> & { getStreamId }` type alias with the interface form (explicit `service`, `type`, `getStreamId`, `getLinkMatcher`). Mentions `ClientAggregate<TLink>` as the consumer convenience.
- §15.2.2 — replaced the single `interface IdReference { path, aggregate: string }` with the discriminated union (`DirectIdReference | LinkIdReference`). Added the response-side variants with `revisionPath`.
- §15.4 — updated the `notebookAggregate` example to use `new ClientAggregate<ServiceLink>({ ... })` instead of the literal-object form.

---

## 2026-05-08 — Refine §15.4 example streamId convention

**Reason.** Verified the §15.4 example against actual demo aggregates in `demos/base/src/*/domain/aggregates.ts`. All four demo aggregates (`NotebookAggregate`, `NoteAggregate`, `TodoAggregate`, `FileObjectAggregate`) use a `${service}.${Type}-${id}` streamId format (`nb.Notebook-...`, `nb.Todo-...`, `storage.FileObject-...`). The spec example used `Notebook-${id}` (no service prefix), which works mechanically but doesn't show the convention real consumers settled on for `<ServiceLink>` usage — the service prefix prevents streamId collisions across services for entities sharing a type name.

**Changes.**

- §15.4 example — updated `getStreamId` body to `\`nb.Notebook-${entityIdToString(id)}\`` (with `nb.` prefix matching demo convention). Updated `matchesStream` predicate to `startsWith('nb.Notebook-')` to match. Switched from arrow-function `getStreamId: (entityId) => ...` to method-shorthand form `getStreamId(id: EntityId): string { ... }` matching the demo style. Reordered `service` before `type` for visual consistency with demo conventions.
- §15.4 — added a paragraph explaining the `${service}.${Type}-${id}` convention as a recommendation (not a library-enforced format) — useful for multi-service apps; library doesn't parse `streamId` itself.
