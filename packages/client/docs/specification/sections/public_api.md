# 9\. Eventing and Public API Surface

## 9.1 Design principles

The CQRS Client event system follows these principles:

- **Events signal change, not state**  
  Events indicate that _something may have changed_; consumers must re-query to obtain current state.

- **Pull-based data access**  
  UI and application code never derive state from events.

- **Stable public surface**  
  Public APIs are identical across online-only and offline-support modes.

- **Transport-agnostic**  
  Events are plain objects suitable for RxJS `fromEvent` or equivalent abstractions.

---

## 9.2 Public modules

The CQRS Client exposes the following modules as independent public interfaces:

- `cacheManager`

- `commandQueue`

- `syncManager`

- `queryManager`

The following modules are internal implementation details and not consumed directly by UI code:

- Event Cache

- Read Model Store

- Event Processors

---

## 9.3 Event categories

Library events are grouped by responsibility.
All events are **fire-and-forget** and **non-authoritative**.

---

### 9.3.1 Session and connectivity events

Emitted by the Sync Manager / Connectivity Manager:

- `SessionInitialized`
  - emitted when a persisted session is loaded at startup

- `SessionReset`
  - emitted after a full local data wipe due to user identity change

- `AuthenticationConfirmed`
  - emitted when the app signals valid authentication

- `ConnectivityStatusChanged`
  - payload: `{ online: boolean }`

  - emitted when network reachability changes

These events allow the application to:

- re-request cache keys

- restart data loading

- pause or resume UI flows

---

### 9.3.2 Cache Manager events

Emitted by the Cache Manager:

- `CacheKeyAdded`

- `CacheKeyAccessed`

- `CacheKeyFrozenChanged`

- `CacheKeyEvicted`

- `CacheQuotaLow`

These events signal cache lifecycle changes only.
Consumers must not assume data availability from them directly.

---

### 9.3.3 Sync lifecycle events

Emitted by the Sync Manager:

- `CollectionSeedStarted`

- `CollectionSeedCompleted`

- `SubscriptionStatusChanged`

- `GapDetected`

- `GapRepairStarted`

- `GapRepairCompleted`

- `StatefulInvalidateScheduled`

- `StatefulRefetchCompleted`

These events are primarily used as **readiness and invalidation signals** for UI orchestration.

---

### 9.3.4 Command Queue events

Emitted by the Command Queue:

- `CommandEnqueued`

- `CommandStatusChanged`

- `CommandSucceeded`

- `CommandFailed`

- `CommandCancelled`

These events signal command lifecycle changes only.
Consumers must query command state explicitly if needed.

---

### 9.3.5 Read model events

Emitted when read model data may have changed:

- `ReadModelUpdated`
  - payload includes:
    - `collectionName`

    - optional `cacheKey`

- `ReadModelEvicted`
  - payload includes:
    - `cacheKey`

These events are the primary invalidation signals for UI data refresh.

---

## 9.4 Event delivery guarantees

- Events are **best-effort**.

- Delivery may be:
  - duplicated

  - delayed

  - missed during reloads or crashes

- Consumers must:
  - treat events as hints

  - always re-query for authoritative state

No event is guaranteed to correspond 1:1 with a state change.

---

## 9.5 Public API shape

Each public module exposes:

- **imperative async methods** (Promises)

- **event emitter** for lifecycle notifications

Example (conceptual):

```ts
cacheManager.on('CacheKeyEvicted', handler)
queryManager.getById(...)
commandQueue.enqueue(...)
```

RxJS integration is achieved by adapting event emitters, not by exposing RxJS directly.

---

## 9.6 Offline-support mode boundary

In offline modes, each public module has:

- a **window-side proxy** (for worker-based modes)

- a **storage worker implementation** (SharedWorker, Dedicated Worker, or main thread)

### 9.6.1 Multi-tab mode (SharedWorker)

- Communication occurs via MessagePort protocols.

- Only the SharedWorker writes to SQLite.

- All connected tabs share a single worker instance.

- Windows query data via requests to the SharedWorker.

### 9.6.2 Single-tab mode (Dedicated Worker)

- Communication occurs via `postMessage` protocols.

- Only the Dedicated Worker writes to SQLite.

- Tab lock ensures single-tab exclusivity.

- Windows query data via requests to the Dedicated Worker.

### 9.6.3 Single-tab mode (main thread)

- No message passing required; direct function calls.

- All operations occur on the main thread.

- Tab lock ensures single-tab exclusivity.

---

## 9.7 Window identity and lifecycle

### 9.7.1 Multi-tab mode

- Each window/tab must generate a unique `windowId` at startup.

- `windowId` is provided to:
  - cache key `hold` / `release` calls

  - lifecycle coordination APIs

- Window identity:
  - is never persisted

  - is cleared on reload or crash

  - exists only for runtime coordination

### 9.7.2 Single-tab modes

- `windowId` coordination is not required (only one window exists).

- Cache key holds are implicit (the single window holds all active keys).

- The tab lock mechanism replaces multi-window coordination.

---

## 9.8 Failure and recovery guarantees

The eventing and API layer must ensure:

- safe operation across reloads and crashes

- no reliance on event ordering

- no cross-session data leakage

- no dependency on internal implementation details

---
