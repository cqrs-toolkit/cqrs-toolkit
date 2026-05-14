# 0004 — Command Queue — Change log

Log of substantive changes to [`0004-command-queue.md`](0004-command-queue.md).
Newest entries at the top; dates in ISO `YYYY-MM-DD`.

---

## 2026-05-11 — Hard/soft `dependsOn` cascade split with source-tagged origins **(DRAFT — ADR 0009 Proposed)**

**Status.** Draft. Tracks [ADR-0009](../../decisions/0009-hard-soft-dependency-classification.md). Section text settles as the ADR moves from Proposed to Accepted; this entry will become a final-form changelog item then.

**Reason.** Every `dependsOn` edge was treated as hard at cascade time — if A failed, every dependent cancelled. Correct for identity-existence ("B's payload references an id A creates") and explicit caller-declared deps, but over-cancelling for chain-only edges where two commands share an aggregate chain but address unrelated state. The exploration ([`command-dependency-hard-soft-classification.md`](../../explorations/command-dependency-hard-soft-classification.md)) decomposes the problem and lands on a per-origin strength rule plus an opt-in classifier callback for the chain-only case.

**Changes.**

- §4.4 — `CommandRecord.dependsOn` documented as `CommandDependency[]` (each entry `{ commandId, source }`). The submit-API `EnqueueCommand.dependsOn?: string[]` stays a flat string array; the library tags entries with `'explicit'` at enqueue. `blockedBy` is clarified as a runtime-narrowed subset of `dependsOn` commandIds (not the inverse view, despite the name).
- §4.6.1 — rewritten to enumerate the three origins (`'entity-ref'`, `'aggregate-chain'`, `'explicit'`), strength rules per origin, the strictest-strength-wins precedence on dedup (`entity-ref > explicit > aggregate-chain`), and the "explicit is always hard" guarantee.
- §4.8.2 — failure-category taxonomy table rewords the `'cancel-cascade'` cells to "hard-and-soft cascade per the rule below"; a new "Hard-and-soft cascade rule" paragraph captures the runtime behaviour, classifier semantics, and chain-stitching that falls out of the existing terminal-status cleanup. The rule's preamble enumerates the three terminal-non-success transitions that trigger the walk — non-`'transient'` failure, user-initiated `cancelCommand`, and cascade-propagated cancellation — so the user-cancellation path isn't read as a gap.
- §4.8.3 — pipeline-time conflict routing reworded: "dependents cascade-cancel" → "hard dependents auto-cancel, soft dependents unblock for an independent attempt"; the `'redundant'` case is called out as the prime example of soft-cascade utility.

**Implementation notes.**

- `IAnticipatedEventHandler` gains `getAnticipatedEvents(commandId): Promise<IAnticipatedEvent[]>` so the cascade walk can populate `ClassifierInput.events` before the terminal-status transition triggers `cleanupOnFailure` and purges the cache.
- Cascade entry points (`processCommandFailure`, `markFailedFromConflict`, `cancelCommand`) snapshot the parent's anticipated events **before** `updateCommandStatus` and forward them into the cascade walk. The walk applies the same pre-snapshot rule for each layer of hard-recursion.
- Soft cascade fires `processPendingCommands()` (fire-and-forget) after flipping any dependent to `'pending'`, which sets `_pendingReprocess = true` on the in-flight drain so freshly-unblocked dependents are picked up in the same drain rather than waiting for the next external trigger.
- The `classifyDependency` callback is declared as a method (not a property arrow) so that per-variant `C` in `myCommand: ClassifierInput<TLink, C, IAnticipatedEvent>` survives method-parameter bivariance — same approach the existing `handler` callback already uses on the same registration. `dependsOnCommand` is broadly typed (`EnqueueCommand`); the consumer runtime-narrows on `command.type` when specific upstream data matters. See ADR-0009 _Alternatives considered_ for the variance regressions that ruled out narrower events typing or a property-arrow declaration.
- One TODO marker placed at the consumer-side devtools `DependencyList` to render the `source` tag in tooltips.

**Tests.**

- `CommandQueue.test.ts` — new `buildCommandDependencies (helper)`, `source tagging at submit`, and `cascade walk — hard vs soft` describe blocks (+9 tests): origin tagging, precedence on collision, hard cascade preserved for explicit/entity-ref, soft cascade flips `'blocked'` → `'pending'`, classifier consulted only for `'aggregate-chain'`, classifier throw halts the walk. Two additional tests in the `cancelCommand` describe block cover the user-initiated cancellation path through the same cascade walk (hard dep cascades, chain-only dep soft-unblocks).
- `commands.integration.test.ts` — `'soft cascade on aggregate-chain edge'` end-to-end: chain-only second update independently succeeds after the first update's server rejection.
- Existing `chain-rebuild.integration.test.ts` assertions updated to match the source-tagged `CommandDependency` shape.

---

## 2026-05-08 — Failure category taxonomy + pluggable mapping API + handler-returned conflicts **(DRAFT — Part 3 in progress)**

**Status.** Draft. Reflects Part 3's implementation as of the current landed slice (categories + mapping API + conflict routing). Text may be refined as later slices reveal further refinements; the demo-server problem+json migration is being handled in a parallel session.

**Reason.** Three threads needed alignment:

1. **Failure routing was binary, not categorized.** Today's `CommandSendException.isRetryable: boolean` and `CommandFailedException.errorCode?: string` give one retry/no-retry axis and an opaque string. The UI ends up string-matching HTTP status codes to discriminate prompt-vs-toast-vs-silent — fragile, and ties UI to transport details.
2. **No way for a handler to signal a categorized failure.** Part 1 gave handlers `{ initial, current }` so they can detect conflicts on regenerate, but the handler's output was `Result<DomainExecutionSuccess, ValidationException | UnknownCommandException>` — no slot for a "conflict, please prompt the user" or "redundant, silently dismiss" signal.
3. **Server failures, while category-shaped at the wire, weren't typed at the API.** Different error formats (problem+json `type` URI, ld+json `@type`, bespoke `body.name`) required ad-hoc string-matching at every consumer; no library-blessed mapping API.

Part 3 establishes the _vocabulary_ and _plumbing_: a `FailureCategory` string-literal union, a pluggable `FailureMapper` API, library defaults for RFC 9110 and recommended body conventions, and a handler-return path that signals categorized failures alongside server-derived ones. The lifecycle response per category is intentionally minimal at this slice — every non-`transient` category transitions to the existing `'failed'` status with `category` accessible to the UI; richer behaviours (a dedicated `'needs-review'` lifecycle, hold-and-retry on `'unauthenticated'`, auto-cleanup for `'redundant'`) graduate as separate slices later.

**Changes.**

- §4.4 — extended the `error?: IException` field description to call out that the persisted exception carries a `category: FailureCategory` field, with cross-reference to the new §4.8 taxonomy.
- §4.7.1 — replaced the trailing "until-then" handler-options note with a forward reference to the new algebraic outcome shape: a handler that detects a conflict on regenerate returns a `'conflict'` outcome carrying a `ConflictException` with a category.
- §4.8 — restructured from "Retry and backoff policy" into "Retry and failure handling" with three sub-sections:
  - §4.8.1 Retry policy — gates retry on `category === 'transient'`; `isRetryable` becomes a derived alias.
  - §4.8.2 Failure category taxonomy — the six-member union (`'transient'`, `'requires-review'`, `'redundant'`, `'unauthenticated'`, `'permission-denied'`, `'permanent'`) with library response per category. Notes the union is extensible.
  - §4.8.3 Pluggable failure mapping — `FailureMapper` shape, `FailureDescriptor` payload, presence-based dispatch (registration → global, no automatic cascade), library-provided defaults (`defaultStatusMapper`, `defaultProblemJsonMapper`, `defaultLdJsonMapper`).
- §4.8.3 also documents **handler-returned conflict routing** with the explicit submit-time vs pipeline-time split:
  - **Submit-time** conflicts (handler first call OR `validateAsync`) reject the submit promise with `Err(ConflictException)`. Command does **not** persist. Same external shape as a validation rejection.
  - **Pipeline-time** conflicts (regenerate during reconcile / id-rewrite cascade / AutoRevision resolution) route via a new `markFailedFromConflict(commandId, exception)` method on `CommandQueue`. The persisted command transitions to `'failed'` with the `category` and `errorCode` from the `ConflictException`; `command:failed` fires; dependents cascade-cancel. `enqueueAndWait`-style awaiters resolve `Err(CommandFailedException)` through the existing terminal-status subscription — no special wiring needed (validated by a new integration test, "pipeline-time conflict transitions command to failed with category accessible").
- §4.8.3 also notes that `validate` keeps `Result<unknown, ValidationException>` (sync, no read-model access) while `validateAsync` widens to `Result<unknown, ValidationException | ConflictException>` (has `queryManager` access; "another entity already has this name" is a natural validateAsync conflict surface).

**Implementation notes.**

- `reconcilePendingCommands` (pure) gains a `conflicts: Map<commandId, ConflictException>` field on `ReconcileOutput`. The caller (SyncManager) iterates the map after the persist phase completes and calls `markFailedFromConflict` for each — keeps the pure function pure and the I/O at the dispatch boundary.
- The two CommandQueue regenerate paths (`rewriteCommandsWithStaleIds`, `resolveDependentRevision`) already inside the queue call `markFailedFromConflict` directly when their re-run returns `'conflict'`.
- Two `TODO(part-2 hard/soft)` markers added at cancel-cascade sites — when hard/soft dep distinction lands, soft (chain-only) dependents should not cascade through; particularly relevant for `'redundant'` conflicts where the user's intent is already satisfied by another path.

**Scope notes.**

- This change captures the _data and routing surface_. Lifecycle changes (new `'needs-review'` status, hold-and-retry, auto-cleanup) are deferred to later slices.
- §4.4 status enum (`'pending' | 'blocked' | 'sending' | 'succeeded' | 'applied' | 'failed' | 'cancelled'`) is unchanged in Part 3.
- Cross-references [`0002 §2.4`](0002-domain-layer.md#24-public-contract-conceptual) which describes the handler's algebraic outcome shape from the Domain Layer perspective.

---

## 2026-05-08 — Persist `modelState` durably; document handler `HandlerState` discriminated union

**Reason.** Two threads in §4.4.2 / §4.7 needed alignment with the Part 1 design:

1. **`modelState` was typed but not durable.** The 2026-05-07 §4.4 schema-alignment entry recorded `modelState` as a submit-time input, but the actual SQL `commands` table (`packages/client/src/storage/schema/client-schema.ts`) had no column for it. It survived only as long as the in-memory record object — a fresh worker reload effectively lost it. This drift was tolerable because nothing in the existing flows depended on the snapshot post-reload, but Part 1 makes the snapshot the durable `initial` field of the handler state input, which forces it to actually persist. Pre-release, the `commands.model_state TEXT` column is added directly to the `init` library step (no separate migration — see the no-new-migrations rule in the repo-root `CLAUDE.md`).

2. **Handler state shape was not documented.** §4.7 described anticipated event production but said nothing about the state argument the consumer's handler receives. The previous signature was `state: T | undefined`; Part 1 changes it to a discriminated-union `HandlerState`: `{ mode: 'initial', initial }` on first call, `{ mode: 'regenerate', initial, current }` on every subsequent invocation. The library always populates `current` with the latest read-model view of the command's primary entity, regardless of what triggered the regenerate (server-event delta, id-rewrite cascade, AutoRevision resolution) — handler behavior is consistent across triggers. Without this in the spec, the regenerate-mode view that handlers depend on is undocumented.

**Changes.**

- §4.4.2 — rewrote the `modelState` description to call out durable persistence (survives reload), and to document its role as the `initial` field of the `HandlerState` union. Spells out that on regenerate the library always populates `current` with the latest read-model view, so handlers don't have to special-case why they were re-invoked. Cross-references the conceptual contract in [`0002 §2.4`](0002-domain-layer.md#24-public-contract-conceptual). Explicit note that Event Processors ([`0008`](0008-event-processors.md)) are out of scope for this shape change — they're entity-level reducers, not command-level functions.

- §4.7.1 — new sub-section "Handler state input — first call vs regenerate." Spells out the two variants:
  - `{ mode: 'initial', initial }` at enqueue.
  - `{ mode: 'regenerate', initial, current }` on every subsequent invocation. `current` is the latest read-model view of the entity, populated consistently across triggers: the reconcile fold's `initialServerState[primaryKey]` for server-event-delta-triggered regenerates (chain continuity for downstream dirty commands flows through the fold's `clientState` output, not through handler input); `readModelStore.getById(...).data` for id-rewrite-cascade and AutoRevision-resolution regenerates.

  Documents that `current` may be `undefined` only when the entity isn't yet in the read-model store, never as a trigger-based signal. Suggests `state.mode === 'regenerate' ? (state.current ?? state.initial) : state.initial` for handlers that just want "the most current view available." Notes the data-shape change is intentionally scoped to data only — the lifecycle decision a handler can make on top of that data (signal "this command needs user review") is deferred to a future spec update aligned with Part 3b.

**Scope notes.**

- This change captures the _data shape_ and _durability requirement_. The lifecycle/exception side (new `'needs-review'` status, typed `ConflictException` family, soft-skip behavior for dependents) is deferred to a later requirement update.
- The §4.4 status enum (`'pending' | 'blocked' | 'sending' | 'succeeded' | 'applied' | 'failed' | 'cancelled'`) is unchanged in Part 1 — the new `'needs-review'` status will be added by Part 3b.

---

## 2026-05-07 — Align §4.4 command record schema with current code

**Reason.** The persisted command record schema in §4.4 / §4.4.1 had drifted significantly from the implementation in `packages/client/src/types/commands.ts`. Three categories of drift:

1. **Missing fields.** Code's `CommandRecord` adds `cacheKey`, `path`, `serverResponse`, `creates` ([0015](0015-aggregate-config.md)), `revision`, `modelState`, `affectedAggregates` ([0015](0015-aggregate-config.md)), `commandIdPaths` ([0014](0014-entity-ref.md)), `seq`, `updatedAt` — none of which the doc listed.
2. **Wrong shapes.** Doc's `payload: object` is `data` in code; doc's `error: { code?, message, details? }` is `error?: IException` in code; doc's `resolution`, `anticipatedEventIds`, `tempIdHints` fields don't exist in code.
3. **Missing `'applied'` status.** Code's `CommandStatus` includes `'applied'` per [ADR 0007 (applied status split)](../../decisions/0007-applied-status-split.md) and [ADR 0008 (applied detection simplification)](../../decisions/0008-applied-detection-simplification-and-wait-api-split.md). The doc never absorbed the split.

**Changes.**

- §4.4 — restructured the field list under group headings (Identity and routing / Lifecycle / Dependencies / Bookkeeping). Renamed `payload` → `data`. Replaced the inline error-shape with `error?: IException`. Removed `resolution?` (not in code). Added `cacheKey`, `path`, `serverResponse`, `seq`, `updatedAt`. Added `'applied'` to the status enum with a note distinguishing terminal status (`'succeeded'`) from post-terminal pipeline-owned status (`'applied'`).
- §4.4 Dependencies — added a note that `dependsOn` is auto-derived from `EntityRef.commandId` values per [0014 §14.6.1](0014-entity-ref.md#1461-automatic-dependson).
- §4.4.1 — replaced the old "anticipatedEventIds / postProcess / tempIdHints" list with the actual EntityRef/aggregate integration fields: `creates` ([0015](0015-aggregate-config.md)), `affectedAggregates` ([0015](0015-aggregate-config.md)), `commandIdPaths` ([0014](0014-entity-ref.md)), `postProcess` (kept, with the caveat that EntityRef and aggregate-driven post-processing are auto-wired).
- §4.4.2 — added "Submit-time inputs" subsection covering `revision` (with `AutoRevision` marker) and `modelState` (consumer-passed read-model snapshot, immutable).
- §4.4.3 — added "File attachments" subsection with `fileRefs` and a forward reference to §4.14.

---

## 2026-05-07 — Align §4.6 / §4.7 / §4.9 with declarative-path reconciliation model

**Reason.** The doc's dependency / post-processing / reconciliation framing predated the EntityRef + AggregateConfig formalization. Four threads:

1. **§4.6.1 Dependencies** missed the auto-wiring rule — `dependsOn` is auto-populated from `EntityRef.commandId` values at paths declared by `commandIdReferences` (per [`0014 §14.6.1`](0014-entity-ref.md#1461-automatic-dependson)). Explicit consumer declarations for cross-command entity references are unnecessary.
2. **§4.6.2 Post-processing** expressed reconciliation as a callback signature `postProcess(parentCommands, parentResponses, childCommand) -> updatedChildCommand`. Implementation refined this into declarative path metadata on `CommandHandlerRegistration` (`commandIdReferences`, `responseIdReferences`, `responseIdMapping`) — the spec is being updated to match the decided shape.
3. **§4.7 anticipated event payload shape** carried the same pre-EntityRef "match server event payload shapes" claim that was corrected in [`0002 §2.2.2`](0002-domain-layer.md#222-anticipated-event-production). Anticipated events may carry `EntityRef` values in fields referencing locally-created entities; server events always carry plain strings.
4. **§4.9 Reconciliation strategies** listed abstract "supported strategies" with a "until standardized…" caveat that no longer reflects reality. The actual flow is concrete: walk `responseIdReferences` paths, build `idMap`, rewrite via `commandIdReferences`, update cache keys, regenerate anticipated events.

**Changes.**

- §4.6.1 — added the auto-`dependsOn` rule and reference to [`0014 §14.6.1`](0014-entity-ref.md#1461-automatic-dependson).
- §4.6.2 — replaced the callback-signature framing with a description of the declarative `commandIdReferences` / `responseIdReferences` / `responseIdMapping` model that implementation settled on. Notes the auto-population default for `responseIdReferences` when a primary aggregate is set. Cross-references [`0014 §14.6.2`](0014-entity-ref.md#1462-automatic-field-rewriting) and [`0015 §15.3`](0015-aggregate-config.md#153-reconciliation).
- §4.7 — applied the same payload-shape qualification used in [`0002 §2.2.2`](0002-domain-layer.md#222-anticipated-event-production) (anticipated events may carry `EntityRef` in fields referencing locally-created entities).
- §4.9 — rewrote the section to describe the concrete reconciliation flow: response ID resolution → idMap construction → command-data rewrite → cache key reconciliation → anticipated event regeneration. Drops the abstract "strategies" and "until standardized" framing.

---

## 2026-05-07 — Align §4.12 events with current code + add timing nuance

**Reason.** §4.12 listed five PascalCase event-type names against a code that exposes nine. Two threads:

1. **Stale name.** Code's runtime key is `command:completed`; the TS-level name should be `CommandCompleted`, not `CommandSucceeded`. The doc's `CommandSucceeded` had no corresponding runtime key.
2. **Missing events and missing nuance.** `CommandSent`, `CommandResponse`, `CommandQueuePaused`, `CommandQueueResumed` weren't listed at all. The terminal-event vs status-flip timing distinction (terminal events fire **after** post-processing; the status-changed event to a terminal status fires **before**) — surfaced in `commands.ts` JSDoc at `isTerminalCommandEvent` — wasn't called out in the spec, but is load-bearing for consumers using `waitForSucceeded` and similar fully-settled-state patterns.

**Changes.**

- §4.12 — renamed `CommandSucceeded` → `CommandCompleted` (matches runtime key `command:completed`). Added `CommandSent`, `CommandResponse`, `CommandQueuePaused`, `CommandQueueResumed`. Called out the `commandqueue:` namespace for the queue-pause/resume pair as a non-mechanical mapping. Added a paragraph about the post-processing timing of terminal event types vs status changes.

---

## 2026-05-07 — Align §3.14 file upload section with current code

**Reason.** Four drift threads in the file upload model:

1. **`FileRef` shape mismatch.** Doc lists `commandId` and `createdAt` fields that don't exist in code; misses `data?: Blob` (the runtime-hydrated upload payload).
2. **`storagePath` leading-slash inconsistency.** Doc shows the field value with a leading slash (`/cqrs-client/uploads/...`); code's JSDoc on the field stores it relative (no leading slash). The OPFS conceptual path is rooted; the persisted field is relative.
3. **Upload conventions extracted from the client.** §3.14.6 described two first-party strategy types (`DirectUploadStrategy`, `S3PresignedUploadStrategy`) selected at library initialization. The architecture deliberately moved away from this: `@cqrs-toolkit/client` is now convention-free at the upload layer, and convention knowledge lives one layer up in `@cqrs-toolkit/hypermedia-client`, which auto-wires upload handlers when the server's Hydra documentation declares a recognized workflow. The first-party convention is `svc:PresignedPostUpload` (S3 presigned form upload via the `PresignedPermit` exchange); the older `S3PresignedUploadStrategy` is superseded by it. Consumers using the hypermedia command sender get this for free; consumers outside hypermedia-client implement upload directly in their command sender.
4. **File store backend list incomplete.** §3.14.1 listed only OPFS (Mode B/C) and in-memory (Mode A). The actual file storage layer is the `ICommandFileStore` interface with three first-party implementations: `OpfsCommandFileStore` (browser worker modes), `InMemoryCommandFileStore` (browser online-only), and `FsCommandFileStore` in `@cqrs-toolkit/client-electron` (`node:fs` in the utility process, with `ElectronCommandFileStore` as the renderer-side IPC bridge). The interface design is deliberate to support all three runtime environments.

**Changes.**

- §3.14.1 — rewrote the file storage model to list all three `ICommandFileStore` backends (OPFS, in-memory, node:fs/Electron) and call out the abstraction as deliberate.
- §3.14.2 — corrected `FileRef` to match `packages/client/src/types/commands.ts:218`. Dropped `commandId` and `createdAt` (not in code). Added `data?: Blob`. Updated `storagePath` JSDoc to reflect the relative form. Generalized the prose to "active file store" instead of "OPFS or in-memory" since Electron is also in the mix.
- §3.14.3 — distinguished the OPFS conceptual path (`/cqrs-client/uploads/{commandId}/{fileId}`) from the persisted `FileRef.storagePath` field value (relative, no leading slash).
- §3.14.6 — replaced the first-party-strategy-types framing with a description of the layered architecture implementation settled on: client is convention-free, hypermedia-client auto-wires recognized workflows (currently `svc:PresignedPostUpload`) via the manifest's command-type → workflow declarations, consumers outside hypermedia-client own upload transport themselves. The hydration parenthetical now references the `ICommandFileStore` abstraction rather than naming OPFS / in-memory specifically.

---

## 2026-05-07 — Generalize §3.14.5 / §3.14.7 around the file store abstraction

**Reason.** §3.14.5 (Orphan cleanup) and §3.14.7 (titled "OPFS write failure") were written when OPFS was the only persistent file backend. With Electron's `FsCommandFileStore` now implementing the same `ICommandFileStore.cleanOrphans` and write-failure contract on `node:fs`, the OPFS-only framing was narrower than the abstraction. The file store must expose the behavior; the Command Queue calls into the interface.

**Changes.**

- §3.14.5 — generalized from "scan `/cqrs-client/uploads/` and delete" (OPFS-specific) to "the file store exposes orphan-cleanup capability; the Command Queue invokes it on startup with the valid command-ID set."
- §3.14.7 — renamed from "OPFS write failure" to "File store write failure". Reframed the prose around the file store abstraction; the no-fallback-between-backends rule now references §3.14.1 for the active-backend resolution.
