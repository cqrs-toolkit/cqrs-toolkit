# 10\. Eventing and Public API Surface

## 10.1 Design principles

The CQRS Client event system follows these principles:

- **Events signal change, not state**  
  Events indicate that _something may have changed_; consumers can re-query to obtain current state, or subscribe to event streams (or the Observable helpers exposed by the Query Manager) to react to updates directly. Push and pull are both first-class consumption patterns and combine naturally — see [`0009 §9.4`](0009-query-manager.md#94-query-model).

- **Stable public surface**  
  Public APIs are identical across online-only and offline-support modes.

- **Transport-agnostic**  
  Events are plain objects suitable for RxJS `fromEvent` or equivalent abstractions.

---

## 10.2 Public modules

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

## 10.3 Event categories

Library events are grouped by responsibility.
All events are **fire-and-forget** and **non-authoritative**.

---

### 10.3.1 Session and connectivity events

Emitted by the Sync Manager / Connectivity Manager:

- `SessionChanged { userId, isNew: boolean }` — emitted when authentication is signaled and the session is established (`isNew: true`) or resumed (`isNew: false`).

- `SessionDestroyed { reason: 'user-changed' | 'explicit' | 'storage-error' }` — emitted on session destruction. The `reason` discriminator carries user-mismatch (after a full local data wipe due to user identity change), explicit logout, and storage-failure cases. Consumers can subscribe for UX prompts (e.g. "you were logged in as X").

- `ConnectivityChanged { online: boolean }` — emitted when network reachability changes.

These events allow the application to:

- re-request cache keys

- restart data loading

- pause or resume UI flows

---

### 10.3.2 Cache Manager events

Emitted by the Cache Manager:

- `CacheKeyAdded`

- `CacheKeyAccessed`

- `CacheKeyFrozenChanged`

- `CacheKeyEvicted` *(runtime key: `cache:evicted` — no `key-` infix)*

- `CacheKeyReconciled` — emitted when EntityRef-driven reconciliation updates a cache key's identity (see [`0003 §3.2.4`](0003-cache-manager.md#324-entityref-driven-inputs-and-reconciliation)).

- `CacheSeedSettled` — emitted per cache key when all matching collections have settled.

- `CacheQuotaLow`

- `CacheQuotaCritical`

- `TooManyWindowsOpen`

- `CacheSessionReset`

These events signal cache lifecycle changes only.
Consumers must not assume data availability from them directly.

---

### 10.3.3 Sync lifecycle events

Emitted by the Sync Manager:

- `SyncStarted { collection }`

- `SyncCompleted { collection, eventCount }`

- `SyncFailed { collection, error }`

- `SyncSeedCompleted { collection, recordCount }`

- `SubscriptionStatusChanged` *(intent; no landed equivalent yet)*

- `SyncGapDetected { streamId, expected, received }`

- `SyncGapRepairStarted { streamId, fromRevision }`

- `SyncGapRepairCompleted { streamId, eventCount }`

- `SyncInvalidateRequested` — invalidation request received for a `(collection, cacheKey)` pair (see [`0005 §5.7`](0005-sync-manager.md#57-stateful-event-handling)).

- `SyncRefetchScheduled { collection, debounceMs }` — debounced refetch scheduled.

- `SyncRefetchExecuted` — refetch executed.

- `SyncWsEventReceived` — WebSocket event observed.

- `SyncWsEventProcessed` — WebSocket event applied to the read model.

These events are primarily used as **readiness and invalidation signals** for UI orchestration.

---

### 10.3.4 Command Queue events

Emitted by the Command Queue:

- `CommandEnqueued`

- `CommandStatusChanged`

- `CommandCompleted` — emitted on success.

- `CommandFailed`

- `CommandCancelled`

- `CommandSent` — emitted when a command is dispatched to the server (after dependencies are satisfied, before the response arrives).

- `CommandResponse` — emitted when a server response arrives for a sent command.

- `CommandQueuePaused` *(runtime key: `commandqueue:paused` — namespace is `commandqueue:`, not `command:`)*

- `CommandQueueResumed` *(runtime key: `commandqueue:resumed` — namespace is `commandqueue:`, not `command:`)*

These events signal command lifecycle changes only.
Consumers must query command state explicitly if needed.

The terminal event types (`CommandCompleted`, `CommandFailed`, `CommandCancelled`) fire after post-processing completes; a `CommandStatusChanged` event whose status is terminal fires before post-processing. See [`0004 §4.12`](0004-command-queue.md#412-events) for the timing nuance.

---

### 10.3.5 Read model events

Emitted when read model data may have changed:

- `ReadModelUpdated` — payload `{ collection, ids, commandIds }`. Emitted when one or more records in a collection have been updated; `ids` carries the affected entity IDs and `commandIds` carries the originating command IDs.

- `ReadModelIdReconciled` — emitted when a temp-ID has been reconciled to a server-assigned ID. Carries the mapping for consumers tracking entity identity through reconciliation (see [`0014 §14.4`](0014-entity-ref.md#144-id-strategy)).

- `ReadModelEvicted { cacheKey }` *(intent; no landed equivalent — eviction is currently signaled via `CacheKeyEvicted` in [§10.3.2](#1032-cache-manager-events))*

These events are the primary invalidation signals for UI data refresh.

---

## 10.4 Event delivery guarantees

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

## 10.5 Public API shape

Each public module exposes:

- **imperative async methods** (Promises) for operations

- **lifecycle notifications** as event subscriptions

Example (conceptual):

```ts
cacheManager.on('CacheKeyEvicted', handler)
queryManager.getById(...)
commandQueue.enqueue(...)
```

The intent is an event subscription shape that doesn't force consumers to import a specific reactive library. UI libraries already provide their own subscription primitives (Solid signals, Svelte stores, etc.); the spec prefers an emitter / native-events shape that adapts naturally to whatever the consumer's UI layer uses.

Current implementation diverges: a single central EventBus exposes events as RxJS Observables (`eventBus.on('cache:key-added').subscribe(...)`), and modules emit through it rather than offering per-module emitters. RxJS was reused because the library already depended on it; whether to change the surface to match the spec's native-events intent, or expand the impl to offer both, is unresolved.

---

## 10.6 Offline-support mode boundary

In offline modes, each public module has:

- a **main thread-side proxy** (for worker-based modes)

- a **storage worker implementation** (SharedWorker, Dedicated Worker, or main thread depending on platform)

### 10.6.1 Multi-tab mode (SharedWorker — Mode C)

- Communication occurs via MessagePort protocols.

- The SharedWorker hosts the execution stack (Sync Manager, Command Queue, Event Processors) and routes SQLite reads and writes to the active tab's DedicatedWorker (see [0001 §1.1.4](0001-modes-and-constraints.md#114-mode-c--shared-worker)). The SharedWorker itself does not touch OPFS or SQLite directly.

- All connected tabs share a single SharedWorker instance.

- Main thread contexts query data via requests to the SharedWorker.

### 10.6.2 Single-tab mode (Dedicated Worker — Mode B)

- Communication occurs via `postMessage` protocols.

- Only the Dedicated Worker writes to SQLite.

- Tab lock ensures single-tab exclusivity.

- Main thread contexts query data via requests to the Dedicated Worker.

### 10.6.3 Online-only mode (Mode A — main thread)

- The execution stack runs on the main thread alongside the rest of the app (see [0001 §1.1.8](0001-modes-and-constraints.md#118-execution-stack-topology)).

- No tab lock — multiple tabs may run concurrently, each with its own independent in-memory state.

- All APIs are direct function calls (no message passing).

- No persistent storage — state lives in plain JS data structures via the `InMemoryStorage` implementation of `IStorage` (see [0001 §1.1.1](0001-modes-and-constraints.md#111-mode-a--online-only)).

- Restarts (page reload, hard navigation) reset all client state.

---

## 10.7 Window identity and lifecycle

### 10.7.1 Multi-tab mode

- Each window/tab must generate a unique `windowId` at startup.

- `windowId` is provided to:
  - cache key `hold` / `release` calls

  - lifecycle coordination APIs

- Window identity:
  - is never persisted

  - is cleared on reload or crash

  - exists only for runtime coordination

### 10.7.2 Single-tab modes

- `windowId` coordination is not required (only one window exists).

- Cache key holds are implicit (the single window holds all active keys).

- The tab lock mechanism replaces multi-window coordination.

---

## 10.8 Failure and recovery guarantees

The eventing and API layer must ensure:

- safe operation across reloads and crashes

- no reliance on event ordering

- no cross-session data leakage

- no dependency on internal implementation details

---
