# 0004 — Command Queue — Change log

Log of substantive changes to [`0004-command-queue.md`](0004-command-queue.md).
Newest entries at the top; dates in ISO `YYYY-MM-DD`.

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
