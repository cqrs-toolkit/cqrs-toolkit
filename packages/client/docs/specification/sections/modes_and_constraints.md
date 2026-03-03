# 0\. Modes, Execution Environment, and Core Constraints

This section defines the execution modes, trust boundaries, and invariants that apply across all components of the CQRS Client library.

---

## 0.1 Supported execution modes

The CQRS Client supports multiple execution modes with identical public APIs.
The choice of mode affects **where state is stored, which execution context owns writes, and whether multiple tabs are permitted**, but does not affect API shape or consumer behavior.

Mode selection follows a tiered fallback:

1. SharedWorker available → **Multi-tab offline mode**
2. Dedicated Worker available → **Single-tab offline mode**
3. Neither available → **Main-thread offline mode**
4. Explicitly configured → **Online-only mode** (in-memory)

---

### 0.1.1 Mode A — Online-only

- All state is stored **in memory only**.

- No worker orchestration.

- No cross-tab coordination.

- No persistence across page reloads.

- Intended for:
  - development

  - test environments

  - deployments where offline persistence is not required

- Public APIs are identical to offline modes and remain asynchronous.

### 0.1.2 Mode B — Multi-tab offline (SharedWorker)

- Requires:
  - SharedWorker support

  - OPFS (Origin Private File System)

- The **SharedWorker is the only writer** for all persistent CQRS Client state, including:
  - Cache Manager metadata

  - Command Queue

  - Sync Manager metadata

  - Event Cache

  - Read Model Store (via processors)

- All connected tabs share a single SQLite WASM instance in the SharedWorker.

- Storage uses SQLite WASM with OPFS persistence.

- Window contexts may only:
  - send control and command messages to the SharedWorker

  - receive library events via MessagePort

  - query data via the SharedWorker

- This mode supports:
  - offline-first startup

  - **unlimited concurrent tabs**, all with full offline capability

  - resilient synchronization

- Platform support: Chrome desktop, Firefox desktop.

### 0.1.3 Mode C — Single-tab offline (Dedicated Worker)

- Requires:
  - Dedicated Worker support

  - OPFS (Origin Private File System)

- The **Dedicated Worker is the only writer** for all persistent CQRS Client state.

- Storage uses SQLite WASM with OPFS persistence.

- **Only one tab may be open at a time.**

- On startup, the library must acquire an exclusive tab lock.

- If another tab already holds the lock:
  - display a blocking modal: "This app is already open in another tab."

  - the tab must not proceed to normal operation

- Window contexts communicate with the Dedicated Worker via `postMessage`.

- This mode supports:
  - offline-first startup

  - single-tab offline capability

  - resilient synchronization

- Platform support: Safari desktop, Android Chrome, environments without SharedWorker.

### 0.1.4 Mode D — Single-tab offline (main thread)

- Requires:
  - OPFS (Origin Private File System) with `opfs-sahpool` VFS support

- All storage operations run on the **main thread**.

- Storage uses SQLite WASM with OPFS persistence via `opfs-sahpool` VFS.

- **Only one tab may be open at a time** (same enforcement as Mode C).

- This mode supports:
  - offline-first startup

  - single-tab offline capability

- Platform support: iOS Safari, environments without Worker support.

- **Note:** Main thread execution may cause brief UI blocking during database operations.

### 0.1.5 Tab lock enforcement (Modes C and D)

For single-tab modes, the library must enforce exclusive access:

```ts
async function acquireTabLock(): Promise<boolean> {
  // Prefer Web Locks API where available
  if ('locks' in navigator) {
    const acquired = await navigator.locks.request(
      'cqrs-client-single-tab',
      { ifAvailable: true },
      async (lock) => !!lock,
    )
    return acquired
  }

  // Fallback: BroadcastChannel + storage-based lease
  return acquireTabLockFallback()
}
```

If the lock cannot be acquired:

- The library must **not** initialize storage or proceed with normal startup.

- A blocking UI must inform the user that another tab is already open.

- The tab may offer to navigate to the existing tab or wait for it to close.

### 0.1.6 SQLite WASM implementation

The library uses **`@sqlite.org/sqlite-wasm`** for SQLite WASM support.

VFS selection by mode:

| Mode                 | VFS            | Notes                                                     |
| -------------------- | -------------- | --------------------------------------------------------- |
| B (SharedWorker)     | `opfs`         | Synchronous, fast, durable. Requires Worker context.      |
| C (Dedicated Worker) | `opfs`         | Same as SharedWorker.                                     |
| D (Main thread)      | `opfs-sahpool` | SharedArrayBuffer-backed async-safe pool for main thread. |
| A (Online-only)      | N/A            | In-memory storage only; no SQLite.                        |

The `opfs` VFS provides synchronous file access within Workers and is the preferred choice for performance.

The `opfs-sahpool` VFS uses a SharedArrayBuffer-backed pool to provide async-safe access from the main thread, required for iOS Safari where Workers may not be available or reliable.

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

---
