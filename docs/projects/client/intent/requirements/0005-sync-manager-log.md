# 0005 — Sync Manager — Change log

Log of substantive changes to [`0005-sync-manager.md`](0005-sync-manager.md).
Newest entries at the top; dates in ISO `YYYY-MM-DD`.

---

## 2026-05-07 — Align §5.4 Collection interface with current code

**Reason.** §5.4 had substantial drift from the `Collection<TLink>` interface in `packages/client/src/types/config.ts:281+`. Six threads:

1. **Wrong location for `subscribeTopics` and `keyTypes`.** Both are on `SeedOnDemandConfig`, not on `Collection` directly. The doc listed them as Collection members.
2. **Missing 0017 territory.** `aggregate: AggregateConfig<TLink>` (required) and `idReferences?: readonly IdReference<TLink>[]` (optional) were missing entirely. These came in with [0015](0015-aggregate-config.md) and are now load-bearing for stream-ID derivation and overlay-event reconciliation.
3. **Missing `cacheKeysFromTopics`.** The WS-ingestion direction of cache-key resolution wasn't represented. The doc had only the seed-time `subscribeTopics(cacheKey)` direction (which is now on `SeedOnDemandConfig`).
4. **Missing `revisionPath`, `seedOnDemand`, narrowing types.** Plus `seedOnInit` is no longer a boolean — it's a structured `SeedOnInitConfig<TLink>` with `{ cacheKey, topics }`. Capability methods are detected at use sites via `CollectionWithFetchStreamEvents` and `isCollectionWithFetchStreamEvents`.
5. **Stale Future work section.** `keyTypes` was listed there despite existing in code; `detectAffectedCollectionsForStateful` was listed but has been superseded by `InvalidationScheduler` in the sync-manager.
6. **Mode/loading pairing not surfaced.** The interface was deliberately refactored so that opting into a seed mode requires its corresponding loading config to be complete — `SeedOnInitConfig` and `SeedOnDemandConfig` bundle the mode's required fields together. Previously fields were independently optional and partial configs surfaced as runtime misbehavior. The doc didn't reflect the design.

Also corrected `matchesStream` framing: the predicate is about *applicability* (events from that stream apply to this collection's read model), not ownership. Cross-aggregate events legitimately match multiple collections.

**Changes.**

- §5.4 — full rewrite. Added a paragraph at the section head explaining the mode/loading pairing pattern (opting into a seed mode requires its sub-config type to be complete; partial configs aren't representable). Restructured into §5.4.1 (Required members), §5.4.2 (Mode opt-ins: `seedOnInit`, `seedOnDemand`), §5.4.3 (Other optional members: `idReferences`, `revisionPath`, `seedPageSize`), §5.4.4 (Capability methods: `fetchSeedRecords`, `fetchSeedEvents`, `fetchStreamEvents` — detected via narrowing types at use sites), §5.4.5 (Sub-config types: `SeedOnInitConfig`, `SeedOnDemandConfig`), §5.4.6 (Fetch context). Removed the stale Future work section. Notes that composite collections built from multiple aggregates are future work and will not be a variant of this interface. `matchesStream` description now says "applies to this collection" rather than "belongs to this collection."

---

## 2026-05-07 — Align §5.6 / §5.7 with current gap-repair and invalidation models

**Reason.** Two drift threads:

1. **§5.6's `eventsEndpoint` was an abstract design-intent statement** that read like a code recipe. The current per-collection pluggable `fetchStreamEvents` model orchestrated by `GapRepairCoordinator` is a better expression of the same intent — fetch missing events for a gap, fall back to lossy when the surfacing collection lacks the capability.
2. **§5.7's stateful refetch strategies needed reframing as work-in-progress.** The intent enumerated `lastUpdated` / `lastStatefulSeenAt` filter strategies as if those were settled directions; implementation took a different correctness-first path — `InvalidationScheduler` triggers full seed-flow re-execution rather than incremental filtering. That implementation isn't intended as the final stateful design either; its purpose at this stage is keeping permanent-event flow consistent and preventing stateful events from corrupting state. The broader stateful-event design will be revisited once a real stateful aggregate enters scope (e.g. during real app client work).

**Changes.**

- §5.6 — reframed around collection-pluggable per-stream fetchers (the realized form of the original abstract intent). Describes the `GapRepairCoordinator` orchestration: fetch via `collection.fetchStreamEvents`, write-queue-driven application via `apply-gap-repair`, `sync:gap-*` events for progress, lossy fallback when the collection lacks the capability (detected via `isCollectionWithFetchStreamEvents`).
- §5.7 — replaced the `lastUpdated`-style strategy framing with a description of the current `InvalidationScheduler` model: debounced (collection, cacheKey)-keyed refetch, processor- and command-success-triggered, full seed-flow re-execution. Added explicit WIP framing — the current implementation is correctness-first interim, not the intended end state, and the broader stateful design is pending; a real stateful aggregate use case will drive it.

---

## 2026-05-07 — Correct §5.5 seed-completion event + fix §5.10 mode/SQLite errors

**Reason.** Two threads:

1. **§5.5's `CollectionSeedCompleted { cacheKey, collectionName }` framing was an authoring-session error.** The doc-authoring session treated cachekey↔collection as 1:1 in places, which produced a per-(cacheKey, collection) event. Intent was always many-to-one — a cache key can be seeded across multiple collections, and consumers subscribe at the cache-key level. Implementation surfaced the mismatch and landed the corrected aggregated-payload event (`CacheSeedSettled`, per-cacheKey, with a `collections: [...]` array carrying each collection's outcome). The spec needed to follow.
2. **§5.10 had factual errors against [0001](0001-modes-and-constraints.md)'s mode definitions**, instances of a recurring hallucination pattern in early spec drafts. The architecture is inspired by Notion's published approach (SQLite + SharedWorker + DedicatedWorker fallback), but the authoring agent repeatedly mis-modeled it on two layers: (a) reading general third-party summaries instead of Notion's detailed technical article and concluding the SharedWorker itself could own SQLite — wrong both for Notion and for this library; the SharedWorker is a router/coordinator and the active tab's DedicatedWorker owns the DB; and (b) assuming full parity with Notion when we deliberately diverged on Mode A. Notion uses SQLite in all modes (in-memory SQLite for single main-tab operation); we omit SQLite from Mode A entirely. Persistence is abstracted behind the `IStorage` interface, which has two distinct implementations: `InMemoryStorage` (plain JS Maps/structures, no DB at all — Mode A uses this) and `SQLiteStorage` (direct read/write to the SQLite WASM DB, no in-memory caching layer). Callers add in-memory caching themselves when it matters to them. (A separate pattern — in-memory-first with flush-to-DB — is used in some non-storage classes; Mode A skips the flushes there. That's not the storage abstraction itself.) The real worker/OPFS/SQLite mechanics for the worker modes were confirmed by testing during the architecture work that produced [`0001 §1.1`](0001-modes-and-constraints.md#11-supported-execution-modes) (commit `a3f8653`, 2026-03-05, "rearchitecture shared-worker to generally match Notion's approach"). Specifically: §5.10.1 claimed the SharedWorker performs SQLite writes (Layer-a hallucination); §5.10.3 was titled "Single-tab mode (main thread)" with claims about a tab lock and SQLite writes — neither is true for Mode A (Layer-b, plus leftover from the "invalid main-thread mode" removed in commit 63a2fbc, 2026-03-04, "Remove invalid main-thread mode").

**Changes.**

- §5.5 — replaced `CollectionSeedCompleted { cacheKey, collectionName }` with `CacheSeedSettled` (runtime key: `cache:seed-settled`) and its aggregated payload `{ cacheKey, status, collections: [...] }`. Made the per-cache-key (not per-collection) emission explicit — consumers needing per-collection completion read the `collections` array.
- §5.10.1 — corrected the SQLite-writer claim: the Sync Manager (via the SharedWorker) routes reads and writes to the active tab's DedicatedWorker; the SharedWorker itself does not touch SQLite. Title now includes "Mode C".
- §5.10.2 — title now includes "Mode B" (no other changes).
- §5.10.3 — rewrote for Mode A: renamed "Single-tab mode (main thread)" → "Online-only mode (Mode A — main thread)". Removed the tab-lock and SQLite-writes claims. Replaced with the actual Mode A semantics: no tab lock, no persistence, in-memory state, restarts reset all state. Cross-references [`0001 §1.1.1`](0001-modes-and-constraints.md#111-mode-a--online-only) / [`§1.1.8`](0001-modes-and-constraints.md#118-execution-stack-topology).

---

## 2026-05-07 — Refine §5.3.4 / §5.9 to match decided session/wipe expression

**Reason.** Two refinements needed:

1. **§5.3.4 used `SessionUserMismatchDetected` as event-shaped intent shorthand.** Implementation refined the signaling into `SessionDestroyed` with a `reason: 'user-changed'` discriminant — the reason enum carries the user-mismatch case alongside other destroy reasons (`'explicit'`, `'storage-error'`), giving consumers a unified subscription point with UX-grade discrimination. Subsequent `SessionChanged { userId, isNew: true }` fires once the new session is established. The intent description in §5.3.4 is being refined to reflect this concrete decision.
2. **§5.9 contradicted [0004 §4.5.3](0004-command-queue.md#453-user-identity-change-handling) on the Command Queue.** §5.9 said pending commands would survive the wipe and require revalidation; 0004 §4.5.3 says the wipe deletes all commands. Confirmed intent: full wipe — commands are deleted along with everything else. Multi-account / loss-of-work UX (e.g. prompting "you were logged in as X" before completing the new login) is implicit future work; the existing `SessionDestroyed { reason: 'user-changed' }` already gives the UX layer the hook it needs.

**Changes.**

- §5.3.4 — replaced the `SessionUserMismatchDetected` shorthand with the refined event signaling: `SessionDestroyed { reason: 'user-changed' }` at mismatch detection (consumer-subscribable for UX prompts), then `SessionChanged { userId, isNew: true }` after the new session is established.
- §5.9 — added the Command Queue to the cleared-data list with a cross-reference to [`0004 §4.5.3`](0004-command-queue.md#453-user-identity-change-handling). Removed the contradictory bullet that claimed pending commands would survive the wipe. Renumbered the remaining steps.
