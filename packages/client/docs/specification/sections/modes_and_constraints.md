# 0. Modes, Execution Environment, and Core Constraints

This section defines the execution modes, trust boundaries, and invariants that apply across all components of the CQRS Client library.

---

## 0.1 Supported execution modes

The CQRS Client supports multiple execution modes with identical public APIs.
The choice of mode affects **where state is stored, which execution context owns writes, and whether multiple tabs are permitted**, but does not affect API shape or consumer behavior.

Mode selection follows a tiered fallback, from best to worst:

1. SharedWorker available, Stage 1 and Stage 2 checks pass → **Mode C — shared-worker** _(preferred)_
2. SharedWorker not available, DedicatedWorker available, Stage 1 and Stage 2 checks pass → **Mode B — dedicated-worker**
3. Any Stage 1 or Stage 2 check fails → **Mode A — online-only**

Mode C is preferred over Mode B. The letter names reflect the order in which modes were specified, not their desirability rank.

**The application is always fully functional in Mode A.** Offline capability is an enhancement, not a requirement. Stage 1 and Stage 2 exist to confirm that offline capability is actually available in the current environment — if either fails, the app falls immediately to Mode A and continues operating normally using JS data structures and RxJS observables. No degraded state, no partial initialization.

On startup, before running any checks, the library reads the **mode cache** from `localStorage` (see §0.1.6). On a cache hit both stages are skipped and the library proceeds directly to mode initialization. On a cache miss the full two-stage detection sequence runs.

> **Note on a simpler SharedWorker architecture:** A natural simplification would be for the SharedWorker to own the SQLite instance directly, eliminating per-tab DedicatedWorkers. This is blocked by two hard browser constraints: (1) `createSyncAccessHandle()` — required by `opfs-sahpool` — is unavailable in `SharedWorkerGlobalScope`; (2) `sqlite3_vfs`, which does not use `createSyncAccessHandle()`, instead requires `SharedArrayBuffer`, which requires `crossOriginIsolated === true` inside the worker — but `crossOriginIsolated` is hardcoded to `false` in `SharedWorkerGlobalScope` in all current browsers regardless of COOP/COEP headers (confirmed Firefox bug [#1984864](https://bugzilla.mozilla.org/show_bug.cgi?id=1984864); same behavior in Chrome). As of early 2026 there is no browser in which SQLite with persistent OPFS storage can run directly inside a SharedWorker.

---

### 0.1.1 Mode A — online-only

- State is managed in **JS data structures and RxJS observables**.
- No SQLite. No WASM. No workers.
- No cross-tab coordination.
- No persistence across page reloads.

Mode A is not a degraded state — it is the baseline operating mode of the library. All features work. Offline capability (resuming cached data after reload, operating without a network connection) is simply not available.

Mode A is entered when:

- Stage 1 capability checks fail (APIs not present in this browser)
- Stage 2 live environment checks fail (APIs present but non-functional in this context)
- Explicitly configured via `mode: 'online-only'`

Known runtime environments where Stage 2 fails and Mode A is entered:

- Private/incognito browsing on Safari (OPFS disabled)
- Private browsing on Firefox (OPFS disabled)
- Chrome incognito (OPFS probe fails due to storage restrictions)

Public APIs are identical to offline modes and remain asynchronous.

---

### 0.1.2 Stage 1 — synchronous capability detection

Stage 1 runs **synchronously on the main thread** before anything is spawned or loaded. It checks only whether the required browser APIs exist in this environment. No workers are created, no I/O is performed, no async operations run.

Stage 1 is fast and cheap. A failure here means the browser fundamentally does not support the APIs required for offline operation. There is nothing to attempt — fall immediately to Mode A.

**Stage 1 does not confirm that these APIs will work.** It confirms only that they exist. A browser may expose the full API surface but still fail to operate correctly in a given context (private browsing, quota restrictions, platform bugs). That is what Stage 2 is for.

```ts
function stageOneCheck(): 'C' | 'B' | 'A' {
  // OPFS synchronous access and Web Locks are required for any offline mode.
  // If either is absent the browser cannot support offline operation at all.
  if (
    typeof navigator.storage?.getDirectory !== 'function' ||
    (typeof FileSystemFileHandle !== 'undefined' &&
      typeof FileSystemFileHandle.prototype.createSyncAccessHandle !== 'function') ||
    !('locks' in navigator)
  ) {
    return 'A'
  }

  // Determine which worker topology is available.
  if (typeof SharedWorker !== 'undefined') return 'C'
  if (typeof Worker !== 'undefined') return 'B'
  return 'A'
}
```

If Stage 1 returns `'A'`, skip Stage 2 entirely and initialize Mode A.
If Stage 1 returns `'C'` or `'B'`, proceed to Stage 2.

---

### 0.1.3 Stage 2 — live environment test

Stage 2 runs **inside a DedicatedWorker** and actually exercises the APIs that Stage 1 confirmed exist. It spawns a worker, loads the SQLite WASM module, and attempts a real `createSyncAccessHandle()` call. Only if all of this succeeds is the environment confirmed safe to use for offline operation.

Stage 2 is necessary because API presence does not guarantee API function. `createSyncAccessHandle()` may exist but fail in private browsing contexts, under quota restrictions, on certain iOS versions, or due to platform-specific bugs. The only way to know it works is to try it.

**The SQLite WASM bundle is not loaded until Stage 2.** A user whose environment fails Stage 2 (or never reaches it) pays no WASM download cost.

**Stage 2 failure means the environment looked capable but is not.** Fall to Mode A, tear down whatever was spawned, do not cache the result.

**Stage 2 sequencing — Mode C:**

```
Stage 1 returns 'C'
  → Main thread spawns DedicatedWorker
  → Worker loads SQLite WASM
  → Worker runs OPFS probe (createSyncAccessHandle)
  → Probe fails:
      Worker calls self.close()
      Main thread falls to Mode A
      (SharedWorker is never contacted)
  → Probe passes:
      Worker reports success to main thread
      Main thread connects to SharedWorker
      SharedWorker registers tab, begins coordination
      Active tab's worker opens opfs-sahpool DB
      First successful DB operation → write mode cache
```

**Stage 2 sequencing — Mode B:**

```
Stage 1 returns 'B'
  → Main thread acquires tab lock (see §0.1.5)
  → Lock not acquired: another tab is active → show blocking modal → stop
  → Lock acquired:
      Main thread spawns DedicatedWorker
      Worker loads SQLite WASM
      Worker runs OPFS probe (createSyncAccessHandle)
      → Probe fails:
          Worker calls self.close()
          Main thread releases tab lock
          Main thread falls to Mode A
      → Probe passes:
          Worker opens opfs-sahpool DB
          First successful DB operation → write mode cache
```

**OPFS probe:**

```ts
// Runs inside DedicatedWorker, before opening any DB
async function probeOPFS(): Promise<boolean> {
  try {
    const root = await navigator.storage.getDirectory()
    const fh = await root.getFileHandle('_cqrs_probe_', { create: true })
    const sah = await fh.createSyncAccessHandle()
    sah.close()
    await root.removeEntry('_cqrs_probe_')
    return true
  } catch {
    return false
  }
}
```

---

### 0.1.4 Mode C — shared-worker

**Entered when:** Stage 1 returns `'C'` and Stage 2 passes.

`opfs-sahpool` requires `createSyncAccessHandle()`, which is only available in `DedicatedWorkerGlobalScope` — not in `SharedWorkerGlobalScope`. The SharedWorker therefore cannot own SQLite directly and acts as a coordinator instead.

**Topology:**

```
Tab 1 (main) → new Worker(sqlite)  ◄── active, holds opfs-sahpool lock
Tab 2 (main) → new Worker(sqlite)  ◄── idle
Tab 3 (main) → new Worker(sqlite)  ◄── idle
        ↑               ↑
        └───────────────┘
          SharedWorker (coordinator)
          - tracks active tab via Web Locks
          - routes all queries to active tab's worker
          - elects new active tab on lock release
```

- Each tab spawns its own **DedicatedWorker** on the main thread at startup.
- A **SharedWorker** tracks the **active tab** and routes all SQLite queries to that tab's DedicatedWorker.
- Only the active tab's DedicatedWorker holds the `opfs-sahpool` database open. All other tabs' workers sit idle.
- The SharedWorker never touches OPFS or SQLite directly.
- All queries travel: `tab main thread → SharedWorker → active tab's DedicatedWorker → SharedWorker → originating tab`.
- Unlimited concurrent tabs; only one writes at a time.

**Active tab election:**

Active tab tracking uses the **Web Locks API**, held on the **main thread of each tab** — not in the DedicatedWorker. Worker lifetime is not guaranteed to match tab lifetime; locks must be held by the tab's main thread.

```ts
// Runs on the main thread of each tab, after Stage 2 passes
navigator.locks.request('cqrs-client-active-tab', () => {
  return new Promise(() => {}) // held until tab closes
})
```

When the active tab's lock is released the SharedWorker elects the next connected tab as active, instructs that tab's DedicatedWorker to open the database, and resumes routing.

**Platform support:** Desktop Chrome, Firefox, Safari; iOS Safari 16+; Firefox for Android.
Chrome for Android does not support SharedWorker → Stage 1 returns `'B'`.
Samsung Internet does not support SharedWorker → Stage 1 returns `'B'`.

> **Reference:** This architecture is described by Roy Hashimoto in [wa-sqlite discussions #81](https://github.com/rhashimoto/wa-sqlite/discussions/81) and implemented in production by Notion (July 2024).

---

### 0.1.5 Mode B — dedicated-worker

**Entered when:** Stage 1 returns `'B'` and Stage 2 passes.

- The tab spawns a single **DedicatedWorker** that owns the SQLite WASM instance.
- Storage uses SQLite WASM with `opfs-sahpool` VFS inside the DedicatedWorker.
- The DedicatedWorker is the only writer for all persistent CQRS Client state.
- Window context communicates with the worker via `postMessage`.

```
Tab (main thread)  ────  DedicatedWorker (SQLite + opfs-sahpool)
```

- **Only one tab may be open at a time.** The tab lock is acquired on the main thread before the worker is spawned.
- If the lock cannot be acquired, no worker is spawned. A blocking modal informs the user another tab is active. The tab does not proceed to normal operation.

**Tab lock:**

```ts
// Runs on the main thread, before spawning DedicatedWorker
async function acquireTabLock(): Promise<boolean> {
  if (!('locks' in navigator)) {
    // Should not be reachable — Stage 1 checks for Web Locks.
    // Defensive fallthrough to Mode A.
    return false
  }
  return new Promise((resolve) => {
    navigator.locks.request('cqrs-client-single-tab', { ifAvailable: true }, (lock) => {
      if (!lock) {
        resolve(false)
        return
      }
      return new Promise<void>(() => resolve(true)) // held until tab closes
    })
  })
}
```

**Platform support:** Chrome for Android; Samsung Internet; any environment where Stage 1 returns `'B'`.

---

### 0.1.6 SQLite WASM implementation

The library uses **`@sqlite.org/sqlite-wasm`** for SQLite WASM support.

VFS and topology by mode:

| Mode | Name             | Worker topology                                           | VFS            | SQLite loaded                                  |
| ---- | ---------------- | --------------------------------------------------------- | -------------- | ---------------------------------------------- |
| C    | shared-worker    | SharedWorker (coordinator) → active tab's DedicatedWorker | `opfs-sahpool` | In DedicatedWorker, after Stage 2 probe passes |
| B    | dedicated-worker | Single DedicatedWorker owns SQLite                        | `opfs-sahpool` | In DedicatedWorker, after Stage 2 probe passes |
| A    | online-only      | None                                                      | N/A            | Never                                          |

Key constraints:

- `opfs-sahpool` uses a pool of pre-opened `SyncAccessHandle` instances. `createSyncAccessHandle()` is only available in `DedicatedWorkerGlobalScope` — never in `SharedWorkerGlobalScope` or the main thread.
- The WASM bundle is never loaded in Mode A. Users whose environment fails either stage pay no WASM download cost.
- In both Modes B and C the SQLite instance always lives in a DedicatedWorker.

---

### 0.1.7 Mode cache

After a mode is confirmed working (first successful DB operation completing Stage 2), the library writes the detected mode to `localStorage`. Subsequent tab startups read this cache and skip both Stage 1 and Stage 2 entirely, proceeding directly to mode initialization.

The cache records the outcome of a previously successful Stage 2 — not just Stage 1 API surface detection. A cache hit means the full environment was verified working on a prior startup.

**Cache schema:**

```ts
interface ModeCache {
  mode: 'C' | 'B' | 'A'
  userAgent: string // invalidated on browser update
  version: number // current: 1
}

const MODE_CACHE_KEY = 'cqrs:mode-cache:v1'
```

Mode A is never written to the cache. A Stage 2 failure means the environment could not be confirmed — the next startup must re-run detection in case conditions have changed (e.g. user left private browsing).

**Write — only after first successful DB operation:**

```ts
function writeModeCache(mode: 'C' | 'B'): void {
  try {
    localStorage.setItem(
      MODE_CACHE_KEY,
      JSON.stringify({
        mode,
        userAgent: navigator.userAgent,
        version: 1,
      }),
    )
  } catch {
    // localStorage unavailable — not fatal, re-detect next startup
  }
}
```

**Read and invalidation:**

```ts
function readModeCache(): ModeCache | null {
  try {
    const raw = localStorage.getItem(MODE_CACHE_KEY)
    if (!raw) return null
    const cache = JSON.parse(raw) as ModeCache
    if (cache.version !== 1) return null
    if (cache.userAgent !== navigator.userAgent) return null
    return cache
  } catch {
    return null
  }
}
```

The cache is invalidated by:

- Browser update (userAgent changes)
- Cache schema version bump
- User clearing site data (localStorage and OPFS are cleared together — naturally consistent)

**Startup flow with cache:**

```
Read localStorage cache
  → Cache hit (version and userAgent match):
      Skip Stage 1 and Stage 2
      Proceed directly to mode initialization
  → Cache miss:
      Run Stage 1 (synchronous)
      Stage 1 → 'A': initialize Mode A, do not write cache
      Stage 1 → 'C' or 'B': run Stage 2
        Stage 2 fails: tear down, fall to Mode A, do not write cache
        Stage 2 passes: initialize mode, after first successful DB op write cache
```

**Multi-tab race on cold start:**

If several tabs open before any cache entry exists, each runs both stages in parallel. In Mode C all tabs connect to the same SharedWorker singleton — at most redundant probe runs, no correctness issue. In Mode B all tabs race for the tab lock — one wins and writes the cache after its first DB operation; the others show the blocking modal. Neither case produces a correctness problem.

**Mode B cache and the single-tab constraint:**

A Mode B cache hit skips detection but does not skip the tab lock. The tab still calls `acquireTabLock()` before spawning a worker. A tab that reads a Mode B cache hit and finds the lock already held proceeds directly to the blocking modal.

**Private/incognito browsing:**

`localStorage` in private browsing is session-scoped and not shared with normal browsing. Private browsing tabs always start with a cache miss and run full detection — correct, since OPFS availability differs between normal and private contexts.

---

### 0.1.8 Execution stack topology

The execution stack — WebSocket connection, command queue, sync manager, and event processor — is placed differently in each mode. The placement is determined by two constraints: (1) which context survives tab changes, and (2) which context can hold the WebSocket open.

**Mode C — SharedWorker owns the execution stack**

```
SharedWorker
  ├── WebSocket connection (one per origin, shared across all tabs)
  ├── Command queue
  ├── Sync manager
  ├── Event processor
  └── SQLite routing → active tab's DedicatedWorker

Tab 1 (main) → DedicatedWorker (SQLite + opfs-sahpool)  ◄── active
Tab 2 (main) → DedicatedWorker (SQLite, idle)
Tab 3 (main) → DedicatedWorker (SQLite, idle)
```

The SharedWorker singleton holds a single WebSocket connection for all tabs. All network I/O and command processing runs in the SharedWorker. SQLite reads and writes are routed to whichever DedicatedWorker currently holds the active-tab lock. When the active tab changes, the execution stack is unaffected — the SharedWorker keeps running without interruption. The WebSocket does not reconnect. The command queue does not pause. In-flight operations do not restart. Tab changeover is a pure storage routing concern.

All APIs required by the execution stack are confirmed available in `SharedWorkerGlobalScope`:

- `WebSocket` — listed in [MDN: Functions available to workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Functions_and_classes_available_to_workers)
- `fetch` — available via `WorkerGlobalScope.fetch()` (inherits to `SharedWorkerGlobalScope`)
- `navigator.locks` — Web Locks API confirmed available in workers
- `IndexedDB` — available via `WorkerGlobalScope.indexedDB`
- `BroadcastChannel` — available in workers

**Mode B — DedicatedWorker owns the execution stack**

```
DedicatedWorker
  ├── WebSocket connection
  ├── Command queue
  ├── Sync manager
  ├── Event processor
  └── SQLite + opfs-sahpool
```

The execution stack and SQLite co-locate in the single DedicatedWorker. Since Mode B allows only one tab at a time, there is no routing or handoff concern.

**Mode A — main thread owns the execution stack**

```
Main thread
  ├── WebSocket connection
  ├── Command queue (RxJS / in-memory JS structures)
  ├── Sync manager
  └── Event processor
```

---

### 0.1.9 SharedWorker lifetime and cold-start behaviour

The SharedWorker is alive as long as at least one tab holds a reference to it via `new SharedWorker(...)`. When its owner set becomes empty the browser terminates the worker and the WebSocket connection closes.

**Client-side navigation (Next.js `<Link>`, SolidStart `<A>`, any `pushState`-based router) does not terminate the SharedWorker.** The document never unloads — the same document that holds the `new SharedWorker(...)` reference keeps running across all route changes. The WS connection is unaffected.

**Full page loads and reloads** (hard navigation, address bar, F5, `location.href =`) do terminate the SharedWorker. This is a cold-start, not a failure:

1. New document loads, spawns fresh SharedWorker
2. Mode cache hit → skips detection, proceeds directly to mode init
3. WebSocket reconnects
4. Commands that were in-flight are still in the OPFS queue — they were persisted before any WS send
5. Sync manager re-establishes position and resumes

The result is identical to normal startup. No data is lost. The user may see a brief loading state instead of an instant render from cache, but this is the same experience as a first load and is already handled by existing loading states.

**Dispatch durability requirement:**

The command queue's `dispatch()` promise must not resolve until the OPFS write is confirmed. A command that has been accepted by the queue but not yet written to OPFS could be lost if a hard navigation occurs before the write completes. Resolving only after the write guarantees that any accepted command survives a subsequent cold-start.

---

## 0.2 Session model and identity constraints

### 0.2.1 Single-session invariant

- The CQRS Client supports **exactly one active user session at a time**.
- All persisted client data belongs to that session.
- The library must never retain or interleave data from multiple users.

There is no support for concurrent or overlapping user sessions.

---

### 0.2.2 Session persistence

- The library persists a minimal **session record** containing:
  - `userId`
  - creation timestamp
  - last-seen timestamp

- The session record is used to:
  - resume cached data when offline
  - detect user identity changes

- If no session record exists, the library is considered uninitialized with respect to user identity.

---

### 0.2.3 Offline-first unauthenticated startup

- The library **may be initialized with unknown or unauthenticated user identity**.

- On startup:
  - the last persisted session (if any) is loaded
  - cached data for that session is made available for querying
  - all network activity is paused

- This enables:
  - application startup while offline
  - display of previously cached data before authentication completes

Cached data may be read, but **no network synchronization may occur** until authentication is confirmed.

---

### 0.2.4 Authentication signaling

- Authentication is **externally owned** by the host application.
- The application must explicitly signal authentication to the library, including the authenticated `userId`.
- Until authentication is signaled:
  - network activity remains paused
  - cached data may still be queried

The library does not perform authentication itself and does not attempt to infer user identity.

---

### 0.2.5 User identity change handling

When authentication is signaled with a `userId`:

- If no prior session exists:
  - a new session is created
  - network activity may resume

- If the `userId` matches the persisted session:
  - the session is resumed
  - network activity may resume

- If the `userId` differs from the persisted session:
  - **all local CQRS Client data must be wiped**
  - a new session is created for the new user
  - cached data from the previous user must not be exposed
  - network activity resumes only after the wipe completes

A user identity change always results in a **hard reset** of local state.

---

## 0.3 Cross-component invariants

The following invariants apply across all components:

- **Server authority**
  Server state is authoritative. Client optimistic state is provisional and must reconcile to server truth.

- **Permanent event ordering**
  Permanent events are globally ordered by `position: bigint` and uniquely identified by `id: uuid`.

- **Unreliable delivery**
  WebSocket delivery may be duplicated or out of order. Missing data must be repaired via REST.

- **Cache key ownership**
  A cache key (including scope keys) defines the boundary of cached data.
  Evicting a cache key must remove all derived local data attributable to that key.

- **Deterministic recovery**
  All components must be resumable without data corruption across reloads, crashes, offline periods, and restarts.

---

## 0.4 Event persistence semantics

Events may originate from the server or from local optimistic execution.

### 0.4.1 Permanent events

- If `event.persistence` is **missing**, the event is treated as **`Permanent`**.
- Permanent events:
  - have `id` and `createdAt`
  - have a stream-local `revision`
  - have a globally ordered `position`
- Permanent events represent authoritative server history.

---

### 0.4.2 Stateful events

- Identified by `event.persistence = 'Stateful'`
- Stateful events:
  - have `id` and `createdAt`
  - do **not** have `revision` or `position`
- Delivery is best-effort.
- They may require snapshot refetch to restore authoritative state.

---

### 0.4.3 Normalization requirement

- The library must treat a missing `event.persistence` field as `'Permanent'`.
- Implementations may normalize events on ingress, but this is not required as long as behavior is correct.
