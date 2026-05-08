# 2\. Cache Manager

## 2.1 Goals and Scope

The Cache Manager is responsible for managing **which data scopes are locally cached** and for coordinating **lifecycle events** that determine when data should be loaded, retained, or evicted.

Its responsibilities are intentionally limited to **metadata and policy**.
It does **not** load data, perform network calls, or store domain records.

The Cache Manager:

- defines the boundaries of offline-capable data via **cache keys**

- enforces eviction policies (LRU, ephemeral, quota-driven)

- coordinates safe multi-tab behavior

- emits lifecycle events consumed by downstream components (notably the Sync Manager)

---

## 2.2 Key Concepts

### 2.2.1 Cache keys and cache scopes

A **cache key** represents a unit of cached data ownership.

Two forms exist:

#### Entity cache keys

Derived from a concrete domain entity:

- `(service, type, entityId)`

- `type ∈ { Tenant, Workspace, Project, Room }`

#### Scope cache keys

Derived from a **logical data scope** not tied to a single entity:

- `(service, scopeType, scopeParams)`

- Examples:
  - “all tenants visible to user”

  - “home task list”

  - “search results with filters X”

Both forms are treated uniformly by the Cache Manager.

Each cache key is represented by a deterministic UUID v5 derived from its identifying tuple.

---

### 2.2.2 Cache key eviction policy

Each cache key has an eviction policy:

- `persistent` (default)
  - participates in normal LRU eviction

  - may be frozen

  - intended for durable offline scope

- `ephemeral`
  - intended for page-scoped or transient views

  - cannot be frozen

  - evicted automatically when no windows actively hold the key

Eviction policy is defined when a key is first created and cannot be changed later.

---

### 2.2.3 Active windows and holds

A cache key may be **actively held** by one or more browser windows (tabs).

- Each window generates a unique `windowId` at startup.

- A window “holds” a cache key while it actively needs the data.

A cache key maintains an **in-memory-only** set:

```ts
activeWindowIds: Set<string>
```

Properties:

- `activeWindowIds` is **never persisted** to storage.

- It is populated at runtime via window interactions.

- A cache key with `activeWindowIds.size > 0` is considered **active**.

This mechanism prevents eviction of data still required by open tabs and applies to **all cache keys**, not only ephemeral ones.

---

## 2.3 Metadata storage schema (persisted)

For each cache key, the Cache Manager persists a single metadata record:

- `key: string`  
  Deterministic UUID v5 identifier.

- `service: string`

- `kind: 'Entity' | 'Scope'`

- `type?: 'Tenant' | 'Workspace' | 'Project' | 'Room'`

- `entityId?: string`

- `scopeType?: string`

- `scopeParamsHash?: string`

- `parentKey: string | null`

- `evictionPolicy: 'persistent' | 'ephemeral'`

- `frozen: boolean`

- `frozenAt: number | null`

- `inheritedFrozen: boolean`

- `lastAccessedAt: number`

- `createdAt: number`

- `estimatedSizeBytes?: number | null`

**Not persisted:**

- `activeWindowIds`

---

## 2.4 Session scoping and startup behavior

### 2.4.1 Session ownership

- All cache metadata belongs to a **single persisted session user**.

- Cache Manager data is invalid if the session user changes.

- On user mismatch, all cache metadata is wiped (see §2.11).

### 2.4.2 Offline-first startup

On application startup:

1.  Cache Manager hydrates persisted metadata.

2.  All keys start with `activeWindowIds = ∅`.

3.  All **ephemeral keys are immediately evicted**.

4.  Persistent keys remain eligible for reactivation.

This ensures:

- ephemeral data is cleared on refresh

- persistent offline data is preserved

---

## 2.5 Public lifecycle API (conceptual)

The Cache Manager exposes the following conceptual operations:

### 2.5.1 Touch (navigation access)

```ts
touch({ windowId, keySpec }): CacheKey
```

- Records user navigation access.

- Updates `lastAccessedAt`.

- Creates the cache key if it does not exist.

- Emits:
  - `CacheKeyAdded` (new key)

  - `CacheKeyAccessed` (existing key)

Touch **does not imply** the window still needs the data.

---

### 2.5.2 Hold (active usage)

```ts
hold({ windowId, key }): void
```

- Adds `windowId` to `activeWindowIds`.

- Marks the key as actively required by that window.

- Prevents eviction while held.

---

### 2.5.3 Release (navigation away)

```ts
release({ windowId, key }): void
```

- Removes `windowId` from `activeWindowIds`.

- If `activeWindowIds` becomes empty:
  - for `ephemeral` keys → immediate eviction

  - for `persistent` keys → becomes eligible for normal eviction

---

## 2.6 Freezing semantics (persistent keys only)

- Only `persistent` keys may be frozen.

- Freezing prevents normal LRU eviction but does not override quota handling.

- Ephemeral keys:
  - cannot be frozen

  - never contribute to inherited freeze state

Freeze behavior and inheritance rules otherwise remain unchanged from prior spec.

---

## 2.7 Normal eviction (LRU-based)

A cache key is eligible for normal eviction if:

- `evictionPolicy === 'persistent'`

- `frozen === false`

- `inheritedFrozen === false`

- `activeWindowIds.size === 0`

Eviction proceeds:

1.  Candidates ordered by `lastAccessedAt` (oldest first).

2.  Eviction occurs **hierarchically**, bottom-up.

3.  One subtree at a time until capacity constraints are satisfied.

---

## 2.8 Ephemeral eviction

Ephemeral eviction rules are strict:

- An ephemeral key is evicted immediately when:
  - `activeWindowIds.size === 0`

- Ephemeral keys:
  - do not participate in LRU

  - are evicted before persistent keys under quota pressure

- Eviction emits standard `CacheKeyEvicted` events.

---

## 2.9 Quota handling and capacity pressure

On storage quota errors (OPFS):

1.  Ephemeral keys are evicted first.

2.  Persistent frozen keys may be evicted if frozen limits are exceeded.

3.  Normal LRU eviction is applied last.

If eviction cannot free sufficient space:

- Emit `CacheQuotaCritical`

- Enter degraded mode (no new keys allowed)

---

## 2.10 Multi-window capacity guard

To prevent pathological behavior when many windows are open:

- Cache Manager enforces a **window capacity limit**:

  ```ts
  maxWindows = floor(maxKeys * windowKeyFraction)
  ```

- If the number of active windows exceeds this limit:
  - new holds are rejected

  - emit `TooManyWindowsOpen`

  - application must prompt the user to close tabs

- Existing windows are **not forcibly evicted**.

This prevents chaotic eviction under constrained storage.

---

## 2.11 User mismatch wipe

If the persisted session user changes:

1.  All cache metadata is deleted.

2.  All in-memory state is cleared.

3.  `CacheSessionReset` is emitted.

4.  Cache Manager returns to empty state.

No cache keys survive a user mismatch.

---

## 2.12 Events

The Cache Manager emits:

- `CacheKeyAdded`

- `CacheKeyAccessed`

- `CacheKeyEvicted`

- `CacheKeyFrozenChanged`

- `CacheQuotaLow`

- `CacheQuotaCritical`

- `TooManyWindowsOpen`

- `CacheSessionReset`

All eviction events use the same payload shape, regardless of eviction reason.

---
