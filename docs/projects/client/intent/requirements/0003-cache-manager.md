# 3\. Cache Manager

## 3.1 Goals and Scope

The Cache Manager is responsible for managing **which data scopes are locally cached** and for coordinating **lifecycle events** that determine when data should be loaded, retained, or evicted.

Its responsibilities are intentionally limited to **metadata and policy**.
It does **not** load data, perform network calls, or store domain records.

The Cache Manager:

- defines the boundaries of offline-capable data via **cache keys**

- enforces eviction policies (LRU, ephemeral, quota-driven)

- coordinates safe multi-tab behavior

- emits lifecycle events consumed by downstream components (notably the Sync Manager)

---

## 3.2 Key Concepts

### 3.2.1 Cache keys and cache scopes

A **cache key** represents a unit of cached data ownership.
Two kinds exist, distinguished by a runtime discriminator (`kind: 'entity' | 'scope'`):

#### Entity cache keys

Tied to a concrete domain entity via a `Link` (from `@meticoeus/ddd-es`):

- `kind: 'entity'`
- `link: TLink` — the entity's identifying link, carrying `{ type, id }` (plain `Link`) or `{ service, type, id }` (`ServiceLink`)
- `parentKey?: string`

The `Link` is generic over the consumer's `TLink` parameter — `type` and `service` values are consumer-defined and library-opaque.
`service` is present on entity keys only when the consumer uses `ServiceLink` (e.g. multi-service apps); single-service apps using plain `Link` have no service field on entity keys.

#### Scope cache keys

A logical data scope not tied to a single entity:

- `kind: 'scope'`
- `service?: string` (optional service context)
- `scopeType: string`
- `scopeParams?: Record<string, unknown>`
- `parentKey?: string`

Examples: "all tenants visible to user", "home task list", "search results with filters X".

Both kinds share `key: string` — an opaque UUID assigned by `registerCacheKey` ([§3.5.1](#351-register)) at first registration and stable thereafter, including across EntityRef reconciliation.
For scope keys without `EntityRef` values, `deriveScopeKey` provides a deterministic UUID v5 derivation as an alternative.

---

### 3.2.2 Cache key eviction policy

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

### 3.2.3 Active windows and holds

A cache key may be **actively held** by one or more browser windows (tabs).

- Each window generates a unique `windowId` at startup.

- A window “holds” a cache key while it actively needs the data.

The Cache Manager tracks active holds in two correlated forms:

- **In-memory:** an `activeWindowIds: Set<string>` per cache key, reflecting which windows currently hold the key.
- **Persisted:** a `holdCount: number` field on the cache key record, updated as holds are added or released.

Properties:

- `activeWindowIds` is **never persisted** to storage.

- It is populated at runtime via window interactions.

- A cache key is **active** iff `activeWindowIds.size > 0` (equivalently, `holdCount > 0` reflects the same state at the persistence boundary).

This mechanism prevents eviction of data still required by open tabs and applies to **all cache keys**, not only ephemeral ones.

---

### 3.2.4 EntityRef-driven inputs and reconciliation

Identity inputs to the Cache Manager — `link.id` for entity cache keys, `scopeParams` values for scope cache keys — may contain `EntityRef` values per [0014 §14.5.5](0014-entity-ref.md#1455-cache-key-derivation).

When a cache key template carrying `EntityRef` values is registered via `registerCacheKey`:

1. The Cache Manager scans the template for `EntityRef` values, including paths declared via `entityRefPaths` for nested or array-typed `scopeParams` structures (uses the JSONPath subset from [0014 §14.5.2.1](0014-entity-ref.md#14521-entity-ref-path-expressions)).
2. For each `EntityRef` found, it records a pending entry — `{ commandId, clientId, paramKey? }` — into the cache key's `pendingIdMappings`. `paramKey` is absent for entity keys (always `link.id`); for scope keys it is the JSONPath into `scopeParams`.
3. The template's identity fields are resolved to their plain-string `entityId` values for identity-string lookup. Registering the same logical entity twice — once with an `EntityRef`, once after reconciliation with the server-confirmed string — finds the same registry entry and shares the same opaque UUID.
4. When the producing command completes successfully, the Cache Manager auto-reconciles: it replaces the temporary ID with the server-assigned ID in the persisted identity columns, drops the corresponding pending entry, and the cache key UUID stays stable across the transition. A `CacheKeyReconciled` event is emitted ([§3.12](#312-events)).

The `idStrategy` on each `EntityRef` (`'temporary'` vs `'permanent'`) determines whether reconciliation actually swaps IDs (`temporary`) or simply marks the entity confirmed (`permanent`).

The default reconciliation strategy replaces the matching ID field in place. Commands whose reconciliation requires a more complex transform may register an optional `resolveCacheKey` callback on their command handler registration; the callback receives the current cache key identity and returns the updated identity.

No separate pending-ID mapping channel from consumer code is needed — all the metadata flows through the `EntityRef` values in the identity tuple.

---

## 3.3 Metadata storage schema (persisted)

For each cache key, the Cache Manager persists a single metadata record:

- `key: string` — opaque UUID assigned by `registerCacheKey`.
- `kind: 'entity' | 'scope'`

**Entity-only columns (null for scope keys):**

- `linkService: string | null` — `link.service` when the consumer uses `ServiceLink`, otherwise null.
- `linkType: string | null` — `link.type`.
- `linkId: string | null` — `link.id`.

**Scope-only columns (null for entity keys):**

- `service: string | null` — optional service context.
- `scopeType: string | null`
- `scopeParams: string | null` — JSON-serialized.

**Common columns:**

- `parentKey: string | null`
- `evictionPolicy: 'persistent' | 'ephemeral'`
- `frozen: boolean`
- `frozenAt: number | null`
- `inheritedFrozen: boolean`
- `lastAccessedAt: number`
- `expiresAt: number | null`
- `createdAt: number`
- `holdCount: number`
- `estimatedSizeBytes: number | null`
- `pendingIdMappings: string | null` — JSON-serialized array of pending ID mappings awaiting command resolution. Each entry: `{ commandId: string; clientId: string; paramKey?: string }`. Null when no IDs are pending (fully resolved or never had pending IDs).

**Not persisted:**

- `activeWindowIds`

---

## 3.4 Session scoping and startup behavior

### 3.4.1 Session ownership

- All cache metadata belongs to a **single persisted session user**.

- Cache Manager data is invalid if the session user changes.

- On user mismatch, all cache metadata is wiped (see [§3.11](#311-user-mismatch-wipe)).

### 3.4.2 Offline-first startup

On application startup:

1.  Cache Manager hydrates persisted metadata.

2.  All keys start with `activeWindowIds = ∅`.

3.  All **ephemeral keys are immediately evicted**.

4.  Persistent keys remain eligible for reactivation.

This ensures:

- ephemeral data is cleared on refresh

- persistent offline data is preserved

---

## 3.5 Public lifecycle API (conceptual)

The Cache Manager exposes the following conceptual operations:

### 3.5.1 Register

```ts
registerCacheKey(template, options?): CacheKey
```

- Primary creation API for cache keys, with EntityRef-aware reconciliation ([§3.2.4](#324-entityref-driven-inputs-and-reconciliation)).
- Accepts a `CacheKeyTemplate` (entity or scope template without a resolved `key` UUID) and assigns an opaque stable UUID.
- Idempotent: registering the same logical entity (after resolving EntityRef inputs to plain strings) returns the same key.
- Emits `CacheKeyAdded` on first registration.

---

### 3.5.2 Touch (navigation access)

```ts
touch({ windowId, keySpec }): CacheKey
```

- Records user navigation access.

- Updates `lastAccessedAt`.

- For scope keys without `EntityRef` inputs, may create the cache key on first touch via deterministic UUID v5 derivation (`deriveScopeKey`).

- Cache keys whose identity may carry `EntityRef` inputs must be created via `registerCacheKey` ([§3.5.1](#351-register)) so reconciliation is auto-wired — `touch` does not handle EntityRef extraction.

- Emits:
  - `CacheKeyAdded` (new key)

  - `CacheKeyAccessed` (existing key)

Touch **does not imply** the window still needs the data.

---

### 3.5.3 Hold (active usage)

```ts
hold({ windowId, key }): void
```

- Adds `windowId` to `activeWindowIds`.

- Marks the key as actively required by that window.

- Prevents eviction while held.

---

### 3.5.4 Release (navigation away)

```ts
release({ windowId, key }): void
```

- Removes `windowId` from `activeWindowIds`.

- If `activeWindowIds` becomes empty:
  - for `ephemeral` keys → immediate eviction

  - for `persistent` keys → becomes eligible for normal eviction

---

## 3.6 Freezing semantics (persistent keys only)

- Only `persistent` keys may be frozen.

- Freezing prevents normal LRU eviction but does not override quota handling.

- Ephemeral keys:
  - cannot be frozen

  - never contribute to inherited freeze state

Freeze behavior and inheritance rules otherwise remain unchanged from prior spec.

---

## 3.7 Normal eviction (LRU-based)

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

## 3.8 Ephemeral eviction

Ephemeral eviction rules are strict:

- An ephemeral key is evicted immediately when:
  - `activeWindowIds.size === 0`

- Ephemeral keys:
  - do not participate in LRU

  - are evicted before persistent keys under quota pressure

- Eviction emits standard `CacheKeyEvicted` events.

---

## 3.9 Quota handling and capacity pressure

On storage quota errors (OPFS):

1.  Ephemeral keys are evicted first.

2.  Persistent frozen keys may be evicted if frozen limits are exceeded.

3.  Normal LRU eviction is applied last.

If eviction cannot free sufficient space:

- Emit `CacheQuotaCritical`

- Enter degraded mode (no new keys allowed)

---

## 3.10 Multi-window capacity guard

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

## 3.11 User mismatch wipe

If the persisted session user changes:

1.  All cache metadata is deleted.

2.  All in-memory state is cleared.

3.  `CacheSessionReset` is emitted.

4.  Cache Manager returns to empty state.

No cache keys survive a user mismatch.

---

## 3.12 Events

The Cache Manager emits the following events.
TypeScript event type names below; runtime keys are kebab-case under the `cache:` namespace and map mechanically (e.g. `CacheKeyAdded` ↔ `cache:key-added`).

- `CacheKeyAdded`

- `CacheKeyAccessed`

- `CacheKeyEvicted` *(runtime key: `cache:evicted` — no `key-` infix)*

- `CacheKeyFrozenChanged`

- `CacheKeyReconciled` — emitted when EntityRef-driven reconciliation updates a cache key's identity ([§3.2.4](#324-entityref-driven-inputs-and-reconciliation)); payload includes the new and previous `CacheKeyIdentity` plus `commandId` / `clientId` / `serverId`.

- `CacheSeedSettled`

- `CacheQuotaLow`

- `CacheQuotaCritical`

- `TooManyWindowsOpen`

- `CacheSessionReset`

---
