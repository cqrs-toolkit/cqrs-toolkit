# 10\. Eviction Contract (Cross-component)

## 10.1 Purpose

This section defines the **cross-component contract** governing eviction of cached data and cache key lifecycle across windows, storage worker restarts, and session changes.

Eviction is a **normal, expected operation** and must never:

- corrupt state

- break command correctness

- leak data across user sessions

- rely on unreliable browser teardown behavior

The contract explicitly accounts for **storage worker lifecycle volatility** (in multi-tab mode) and **tab lock semantics** (in single-tab modes).

---

## 10.2 Eviction triggers

Eviction may be triggered by:

- cache capacity limits (LRU eviction)

- quota pressure

- explicit eviction of **ephemeral cache keys**

- loss of all active window holds for an ephemeral key (multi-tab mode only)

- storage worker restart without restored holds (multi-tab mode only)

- session reset (user identity change)

Eviction does **not** imply error or failure.

---

## 10.3 Cache key lifecycle states

Each cache key may be in one or more of the following conceptual states:

- **Inactive**
  - key exists in metadata

  - no active window holds

- **Active (held)**
  - at least one live window holds the key

- **Frozen**
  - explicitly user-frozen

- **Ephemeral**
  - must be evicted once no windows hold it

A cache key may simultaneously be:

- active + frozen

- active + ephemeral

---

## 10.4 Window holds and liveness model (multi-tab mode only)

**Note:** This section applies only to **multi-tab mode** (SharedWorker). In single-tab modes, window hold coordination is unnecessary because only one tab exists.

### 10.4.1 Hold semantics (authoritative intent)

- Windows must explicitly declare interest in a cache key via a **hold** call.

- Each hold is associated with a `windowId`.

- Holds represent **intent**, not ownership.

The Cache Manager maintains, in the SharedWorker, an **in-memory only** mapping:

```ts
activeWindowIdsByKey: Map<cacheKey, Set<windowId>>
```

This mapping:

- exists only in the SharedWorker

- is never persisted

- is authoritative for eviction decisions

---

### 10.4.2 Release semantics (best-effort)

Windows must attempt to release holds when they no longer need data.

**Required window behavior:**

- On navigation away from a page:
  - release holds for keys no longer required

- On page teardown:
  - send a single message:

```ts
releaseAll({ windowId })
```

This removes **all holds associated with the window**.

Notes:

- `pagehide` is the preferred event.

- `beforeunload` / `unload` are insufficient alone.

- This mechanism is **best-effort** and not relied upon for correctness.

---

## 10.5 Heartbeat Manager (multi-tab mode only)

**Note:** This section applies only to **multi-tab mode** (SharedWorker). In single-tab modes, heartbeat coordination is unnecessary.

Because window teardown is unreliable and the SharedWorker may be restarted at any time, the SharedWorker must act as the **source of truth for window liveness**.

---

### 10.5.1 Window registration

- Each window must generate a stable `windowId` at startup.

- On startup, the window must register itself:

```ts
registerWindow({ windowId })
```

The SharedWorker records:

```ts
lastSeenAt[windowId] = now
```

---

### 10.5.2 Heartbeat protocol

- Each registered window must periodically send:

```ts
heartbeat({ windowId })
```

- The SharedWorker updates `lastSeenAt[windowId]`.

Heartbeat cadence and TTL are implementation-defined but must ensure:

- stale windows are detected within a bounded time

- false positives (live windows marked dead) are rare

---

### 10.5.3 Stale window cleanup

If:

```ts
now - lastSeenAt[windowId] > WINDOW_TTL
```

then the SharedWorker must:

1.  consider the window dead

2.  remove `windowId` from **all** activeWindowIds sets

3.  re-evaluate eviction rules for affected keys

This cleanup is authoritative and does not require window cooperation.

---

## 10.6 Storage worker restart resilience (multi-tab mode only)

**Note:** This section applies only to **multi-tab mode** (SharedWorker). In single-tab modes, worker restart simply requires reinitializing the storage layer.

### 10.6.1 SharedWorker volatility

- The SharedWorker may be terminated at any time while windows remain open (e.g., if all MessagePorts are garbage collected briefly).

- On restart:
  - all in-memory state is lost

  - all window registrations and holds are forgotten

  - persisted SQLite data remains intact

This is expected browser behavior.

---

### 10.6.2 Worker instance identity

- Each SharedWorker instance must generate a unique `workerInstanceId` at startup.

- The `workerInstanceId` must be:
  - included in responses and events sent to windows, or

  - broadcast to all windows on connection

This allows windows to detect a **new SharedWorker instance**.

---

### 10.6.3 Window-side hold tracking

Each window must maintain its own **authoritative list of held cache keys**:

```ts
heldKeys: Set<cacheKey>
```

This state:

- exists only in the window

- is independent of the SharedWorker

- represents the window's current data requirements

---

### 10.6.4 Hold restoration protocol

When a window detects a new SharedWorker instance (via `workerInstanceId` change):

1.  the window must re-register:

```ts
registerWindow({ windowId })
```

2.  the window must restore all current holds in **one batch**:

```ts
restoreHolds({
  windowId,
  keys: [...heldKeys],
})
```

The SharedWorker must treat restored holds identically to normal holds.

This guarantees correctness after worker restarts without leaking ephemeral data.

---

## 10.7 Ephemeral cache keys

### 10.7.1 Definition

An **ephemeral cache key** is a cache key whose data must not persist beyond active usage.

Ephemeral behavior applies at the **cache key level**, not per collection.

---

### 10.7.2 Eviction rule for ephemeral keys (multi-tab mode)

When:

```ts
ephemeral === true
AND activeWindowIds.size === 0
```

then:

- the cache key **must be evicted immediately**

- eviction bypasses normal LRU ordering

- normal eviction events are emitted

If holds are not restored after a SharedWorker restart, eviction is correct and expected.

### 10.7.3 Eviction rule for ephemeral keys (single-tab modes)

In single-tab modes, ephemeral keys are evicted when:

- the page navigates away from the associated view, or

- the tab is closed (data lost with the session)

---

## 10.8 Persistent cache keys

Persistent (non-ephemeral) cache keys:

- remain eligible for normal LRU eviction

- may be evicted under:
  - capacity pressure

  - quota pressure

- respect frozen and inheritedFrozen semantics

Active window holds do **not** strictly prevent eviction, but implementations may deprioritize evicting active keys.

---

## 10.9 Component responsibilities on `CacheKeyEvicted`

When `CacheKeyEvicted(key)` is emitted, components must respond as follows:

### 10.9.1 Cache Manager

- Removes metadata

- Clears hold state

- Emits eviction events bottom-up

### 10.9.2 Sync Manager

- Stops synchronization

- Unsubscribes from topics

- Deletes key-scoped sync metadata

### 10.9.3 Read Model Store

- Deletes all records with `cacheKey === key`

- Deletes link-table and derived records

### 10.9.4 Event Cache

- Deletes buffered events attributable to the key

- Retains unattributed anticipated events until resolved normally

### 10.9.5 Event Processors

- Must tolerate missing baselines

- Must not throw due to eviction

### 10.9.6 Command Queue

- **Must not cancel or delete commands**

- Commands survive eviction

**Exception:** session reset (§10.10).

---

## 10.10 Session reset (hard eviction)

When a session reset occurs (user identity change):

- all cache keys are evicted

- all Read Model data is wiped

- all Event Cache data is wiped

- the Command Queue is wiped

- all window registrations, holds, and heartbeat state are cleared (multi-tab mode)

A `SessionReset` event must be emitted after completion.

---

## 10.11 Guarantees

This eviction contract guarantees that:

- ephemeral data never leaks beyond active usage

- storage worker restarts cannot corrupt or strand cache state (multi-tab mode)

- stale windows cannot block eviction (multi-tab mode)

- single-tab enforcement prevents concurrent access conflicts (single-tab modes)

- commands remain correct and durable

- session changes never leak data across users

- the system always recovers via re-query and re-sync

---
