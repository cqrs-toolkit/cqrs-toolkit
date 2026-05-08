# 0010 — Public API — Change log

Log of substantive changes to [`0010-public-api.md`](0010-public-api.md).
Newest entries at the top; dates in ISO `YYYY-MM-DD`.

---

## 2026-05-07 — Fix §10.6 worker / mode hallucinations + generic main-thread framing

**Reason.** §10.6 carried the same hallucination pattern documented in [`0005-sync-manager-log.md`](0005-sync-manager-log.md)'s 2026-05-07 entry. The architecture is inspired by Notion's published approach but the authoring agent repeatedly mis-modeled it on two layers: (a) reading general third-party summaries and concluding the SharedWorker itself could own SQLite (wrong both for Notion and for this library; the SharedWorker is a router/coordinator and the active tab's DedicatedWorker owns the DB); and (b) assuming full parity with Notion when this library deliberately diverged on Mode A (Notion uses SQLite in all modes; this library omits SQLite from Mode A entirely, using `InMemoryStorage` plain-JS structures). The real worker/OPFS/SQLite mechanics for the worker modes were confirmed by testing during the architecture work that produced [`0001 §1.1`](0001-modes-and-constraints.md#11-supported-execution-modes) (commit `a3f8653`, 2026-03-05). The "invalid main-thread mode" was removed in commit `63a2fbc` (2026-03-04).

Specifically:

- §10.6.1 claimed the SharedWorker performs SQLite writes (Layer-a hallucination).
- §10.6.3 was titled "Single-tab mode (main thread)" with claims about a tab lock and SQLite writes — neither is true for Mode A (Layer-b, plus leftover from the removed main-thread mode).

Also generalized the "window-side proxy" framing to "main thread-side proxy" — deliberately generic on what hosts the main thread (browser tab, Electron renderer, etc.). The library's internal adapter discriminator currently uses `'window' | 'worker'` but the spec stays platform-agnostic at this level.

**Changes.**

- §10.6 umbrella — replaced "window-side proxy" with "main thread-side proxy" (deliberately generic on main-thread host).
- §10.6.1 — corrected the SharedWorker / SQLite ownership claim: the SharedWorker hosts the execution stack and routes reads / writes to the active tab's DedicatedWorker; the SharedWorker itself does not touch OPFS or SQLite. Title now includes "Mode C". "Windows query data" → "Main thread contexts query data".
- §10.6.2 — title now includes "Mode B"; "Windows" → "Main thread contexts".
- §10.6.3 — rewrote for Mode A: renamed "Single-tab mode (main thread)" → "Online-only mode (Mode A — main thread)". Removed the tab-lock and SQLite-writes claims. Replaced with the actual Mode A semantics: no tab lock, multiple tabs may run independently, no persistent storage (`InMemoryStorage` plain-JS), restarts reset all state. Cross-references [`0001 §1.1.1`](0001-modes-and-constraints.md#111-mode-a--online-only) / [`§1.1.8`](0001-modes-and-constraints.md#118-execution-stack-topology).

---

## 2026-05-07 — Align §10.3 event lists with implementation

**Reason.** §10.3 carried a mix of stale event names, missing events that have since landed, and one or two events that have not landed yet. The doc's event lists predated the work logged in [`0003-cache-manager-log.md`](0003-cache-manager-log.md) §3.12, [`0004-command-queue-log.md`](0004-command-queue-log.md) §4.12, and [`0005-sync-manager-log.md`](0005-sync-manager-log.md) §5.3.4. Aligning all five subsections in one pass for consistency.

**Changes.**

- §10.3.1 — replaced `SessionInitialized`, `SessionReset`, `AuthenticationConfirmed` with the landed shape: `SessionChanged { userId, isNew }` and `SessionDestroyed { reason: 'user-changed' | 'explicit' | 'storage-error' }`. The `reason` discriminator on `SessionDestroyed` covers the user-mismatch case (formerly `SessionReset`) along with explicit logout and storage-failure. Renamed `ConnectivityStatusChanged` → `ConnectivityChanged` to match the landed runtime key `connectivity:changed`.
- §10.3.2 — added the five missing events: `CacheKeyReconciled` (EntityRef-driven cache key reconciliation per [`0003 §3.2.4`](0003-cache-manager.md#324-entityref-driven-inputs-and-reconciliation)), `CacheSeedSettled` (per-cache-key seed completion aggregating all matching collections), `CacheQuotaCritical`, `TooManyWindowsOpen`, `CacheSessionReset`. Called out `CacheKeyEvicted ↔ cache:evicted` (no `key-` infix) as the one non-mechanical name mapping.
- §10.3.3 — refined the existing event names with the `Sync` prefix to match landed runtime keys (`CollectionSeedStarted` → `SyncStarted`; `CollectionSeedCompleted` → `SyncSeedCompleted`; `GapDetected` → `SyncGapDetected`; `GapRepairStarted` → `SyncGapRepairStarted`; `GapRepairCompleted` → `SyncGapRepairCompleted`; `StatefulInvalidateScheduled` → `SyncInvalidateRequested`; `StatefulRefetchCompleted` → `SyncRefetchExecuted`). Added `SyncCompleted`, `SyncFailed`, `SyncRefetchScheduled`, `SyncWsEventReceived`, `SyncWsEventProcessed`. Marked `SubscriptionStatusChanged` as intent (no landed equivalent yet).
- §10.3.4 — renamed `CommandSucceeded` → `CommandCompleted` (matches landed runtime key `command:completed`). Added `CommandSent`, `CommandResponse`, `CommandQueuePaused`, `CommandQueueResumed` with the namespace callout (`commandqueue:` for the queue-pause/resume pair). Added the post-processing-vs-status-flip timing nuance from [`0004 §4.12`](0004-command-queue.md#412-events).
- §10.3.5 — corrected `ReadModelUpdated` payload from `{ collectionName, optional cacheKey }` to the landed `{ collection, ids, commandIds }`. Added `ReadModelIdReconciled` for temp-ID reconciliation signaling (cross-references [`0014 §14.4`](0014-entity-ref.md#144-id-strategy)). Marked `ReadModelEvicted` as intent (no landed equivalent — eviction currently signaled via `CacheKeyEvicted` in §10.3.2).

---

## 2026-05-07 — Reframe §10.1 push/pull duality

**Reason.** The "Pull-based data access" principle was a holdover from the library's first incarnation when it was app-specific and Redux drove reactivity externally (same root cause as [`0009 §9.4`](0009-query-manager.md#94-query-model)'s pull-only framing). Push (subscribe to library events) is now first-class alongside pull, and combining the two is the standard pattern for reactive UI.

**Changes.**

- §10.1 — folded "Pull-based data access" into the "Events signal change, not state" principle by acknowledging that consumers can either re-query or subscribe to event streams. Cross-references [`0009 §9.4`](0009-query-manager.md#94-query-model) for the full push/pull duality.

---

## 2026-05-07 — Document §10.5 native-events vs RxJS divergence

**Reason.** §10.5 expressed a per-module `.on(...)` emitter shape and stated "RxJS integration is achieved by adapting event emitters, not by exposing RxJS directly." Implementation diverges on two axes: (1) modules emit through a central `EventBus` rather than per-module emitters, and (2) `EventBus.on()` returns RxJS Observables directly — RxJS was reused because the library already depended on it. The spec's not-RxJS intent (avoid forcing consumers to import a specific reactive library when their UI layer already provides subscription primitives) hasn't been settled either way; the divergence reflects an expedient default rather than an adjudicated decision.

**Changes.**

- §10.5 — refined the example and surrounding prose to acknowledge both the spec intent (native-events / per-module emitter shape that adapts to any consumer's reactive library) and the current implementation reality (central `EventBus` with RxJS Observables). Both framings are presented; the resolution is unresolved and tracked in the explorations wing.

