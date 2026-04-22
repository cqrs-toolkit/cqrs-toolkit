[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / CacheManager

# Class: CacheManager\<TLink, TCommand\>

Cache manager implementation.

## Type Parameters

### TLink

`TLink` _extends_ `Link`

### TCommand

`TCommand` _extends_ [`EnqueueCommand`](../interfaces/EnqueueCommand.md)

## Implements

- `ICacheManagerInternal`\<`TLink`\>

## Constructors

### Constructor

> **new CacheManager**\<`TLink`, `TCommand`\>(`eventBus`, `storage`, `config?`): `CacheManager`\<`TLink`, `TCommand`\>

#### Parameters

##### eventBus

[`EventBus`](EventBus.md)\<`TLink`\>

##### storage

[`IStorage`](../interfaces/IStorage.md)\<`TLink`, `TCommand`\>

##### config?

[`CacheManagerConfig`](../interfaces/CacheManagerConfig.md) = `{}`

#### Returns

`CacheManager`\<`TLink`, `TCommand`\>

## Methods

### acquire()

> **acquire**(`cacheKey`, `options?`): `Promise`\<`string`\>

Acquire a cache key, returning only the UUID string.
Convenience wrapper around [acquireKey](#acquirekey) for callers that only need the key.

#### Parameters

##### cacheKey

[`CacheKeyIdentity`](../type-aliases/CacheKeyIdentity.md)\<`TLink`\>

##### options?

[`AcquireCacheKeyOptions`](../interfaces/AcquireCacheKeyOptions.md)

#### Returns

`Promise`\<`string`\>

#### Implementation of

`ICacheManagerInternal.acquire`

---

### acquireKey()

> **acquireKey**(`cacheKey`, `options?`): `Promise`\<[`CacheKeyIdentity`](../type-aliases/CacheKeyIdentity.md)\<`TLink`\>\>

Acquire a cache key identity. Creates or updates in the in-memory registry.
Returns the full identity object with the UUID key and all source data.

For keys created via `registerCacheKey`, the registry already has the entry —
this just touches lastAccessedAt and applies hold. For UUID v5 keys (e.g., from
`deriveScopeKey`), the registry entry is created here.

#### Parameters

##### cacheKey

[`CacheKeyIdentity`](../type-aliases/CacheKeyIdentity.md)\<`TLink`\>

##### options?

[`AcquireCacheKeyOptions`](../interfaces/AcquireCacheKeyOptions.md)

#### Returns

`Promise`\<[`CacheKeyIdentity`](../type-aliases/CacheKeyIdentity.md)\<`TLink`\>\>

#### Implementation of

`ICacheManagerInternal.acquireKey`

---

### checkSessionUser()

> **checkSessionUser**(`userId`): `Promise`\<`boolean`\>

#### Parameters

##### userId

`string`

#### Returns

`Promise`\<`boolean`\>

---

### evict()

> **evict**(`key`): `Promise`\<`boolean`\>

Explicitly evict a cache key.

#### Parameters

##### key

`string`

Cache key UUID

#### Returns

`Promise`\<`boolean`\>

Whether eviction succeeded

#### Implementation of

`ICacheManagerInternal.evict`

---

### evictAll()

> **evictAll**(): `Promise`\<`number`\>

Evict all evictable cache keys.

#### Returns

`Promise`\<`number`\>

Number of cache keys evicted

#### Implementation of

`ICacheManagerInternal.evictAll`

---

### evictExpired()

> **evictExpired**(): `Promise`\<`number`\>

Evict expired cache keys.

#### Returns

`Promise`\<`number`\>

Number of cache keys evicted

#### Implementation of

`ICacheManagerInternal.evictExpired`

---

### exists()

> **exists**(`key`): `Promise`\<`boolean`\>

Check if a cache key exists.

#### Parameters

##### key

`string`

Cache key UUID

#### Returns

`Promise`\<`boolean`\>

Whether the cache key exists

#### Implementation of

`ICacheManagerInternal.exists`

---

### existsSync()

> **existsSync**(`key`): `boolean`

Check if a cache key exists.

#### Parameters

##### key

`string`

Cache key UUID

#### Returns

`boolean`

Whether the cache key exists

#### Implementation of

`ICacheManagerInternal.existsSync`

---

### filterExistingCacheKeys()

> **filterExistingCacheKeys**(`keys`): `Promise`\<`string`[]\>

Filter an array of cache key strings to only those that exist in storage.

#### Parameters

##### keys

`string`[]

Cache key UUIDs to check

#### Returns

`Promise`\<`string`[]\>

The subset of keys that exist

#### Implementation of

`ICacheManagerInternal.filterExistingCacheKeys`

---

### freeze()

> **freeze**(`key`): `Promise`\<`void`\>

Freeze a cache key.

#### Parameters

##### key

`string`

Cache key UUID

#### Returns

`Promise`\<`void`\>

#### Implementation of

`ICacheManagerInternal.freeze`

---

### get()

> **get**(`key`): `Promise`\<[`CacheKeyRecord`](../interfaces/CacheKeyRecord.md) \| `undefined`\>

Get a cache key record.

#### Parameters

##### key

`string`

Cache key UUID

#### Returns

`Promise`\<[`CacheKeyRecord`](../interfaces/CacheKeyRecord.md) \| `undefined`\>

Cache key record or undefined

#### Implementation of

`ICacheManagerInternal.get`

---

### getCount()

> **getCount**(): `Promise`\<`number`\>

Get the number of cache keys.

#### Returns

`Promise`\<`number`\>

Total cache key count

#### Implementation of

`ICacheManagerInternal.getCount`

---

### hold()

> **hold**(`_key`): `Promise`\<`void`\>

Place a hold on a cache key.
While held, the cache key cannot be evicted.

#### Parameters

##### \_key

`string`

#### Returns

`Promise`\<`void`\>

#### Implementation of

`ICacheManagerInternal.hold`

---

### holdForWindow()

> **holdForWindow**(`key`, `windowId`): `void`

Place a hold on a cache key for a specific window.
While held by any window, the cache key cannot be evicted.
Idempotent: calling hold twice for the same window is a no-op.

#### Parameters

##### key

`string`

##### windowId

`string`

#### Returns

`void`

#### Implementation of

`ICacheManagerInternal.holdForWindow`

---

### initialize()

> **initialize**(): `Promise`\<`void`\>

Initialize the cache manager.
Loads persisted cache keys into the in-memory registry,
resets hold counts, evicts ephemeral keys, and registers this window.

#### Returns

`Promise`\<`void`\>

#### Implementation of

`ICacheManagerInternal.initialize`

---

### isFrozen()

> **isFrozen**(`key`): `Promise`\<`boolean`\>

Check if a cache key is frozen.

#### Parameters

##### key

`string`

Cache key UUID

#### Returns

`Promise`\<`boolean`\>

Whether the cache key is frozen

#### Implementation of

`ICacheManagerInternal.isFrozen`

---

### onSessionDestroyed()

> **onSessionDestroyed**(): `Promise`\<`void`\>

Handle session destroyed — clears all cache state.

#### Returns

`Promise`\<`void`\>

#### Implementation of

`ICacheManagerInternal.onSessionDestroyed`

---

### registerCacheKey()

> **registerCacheKey**(`template`, `options?`): `Promise`\<[`CacheKeyIdentity`](../type-aliases/CacheKeyIdentity.md)\<`TLink`\>\>

Register a cache key from a template. Assigns a stable opaque UUID.
Auto-wires pending ID reconciliation from EntityRef values in the template.

Async wrapper around registerCacheKeySync — schedules a dirty flush after.

#### Parameters

##### template

[`CacheKeyTemplate`](../type-aliases/CacheKeyTemplate.md)\<`TLink`\>

##### options?

[`AcquireCacheKeyOptions`](../interfaces/AcquireCacheKeyOptions.md)

#### Returns

`Promise`\<[`CacheKeyIdentity`](../type-aliases/CacheKeyIdentity.md)\<`TLink`\>\>

#### Implementation of

`ICacheManagerInternal.registerCacheKey`

---

### registerCacheKeySync()

> **registerCacheKeySync**(`template`, `options?`): [`CacheKeyIdentity`](../type-aliases/CacheKeyIdentity.md)\<`TLink`\>

Synchronous registration. Called by internal callers in the same thread.
Does not touch storage — the dirty flush handles persistence.

#### Parameters

##### template

[`CacheKeyTemplate`](../type-aliases/CacheKeyTemplate.md)\<`TLink`\>

##### options?

[`AcquireCacheKeyOptions`](../interfaces/AcquireCacheKeyOptions.md)

#### Returns

[`CacheKeyIdentity`](../type-aliases/CacheKeyIdentity.md)\<`TLink`\>

#### Implementation of

`ICacheManagerInternal.registerCacheKeySync`

---

### registerWindow()

> **registerWindow**(`windowId`): `boolean`

Register a window for capacity tracking.
Returns false and emits event if at capacity.

#### Parameters

##### windowId

`string`

#### Returns

`boolean`

#### Implementation of

`ICacheManagerInternal.registerWindow`

---

### release()

> **release**(`_key`): `Promise`\<`void`\>

Release a hold on a cache key.

#### Parameters

##### \_key

`string`

#### Returns

`Promise`\<`void`\>

#### Implementation of

`ICacheManagerInternal.release`

---

### releaseAllForWindow()

> **releaseAllForWindow**(`windowId`): `Promise`\<`void`\>

Release all holds for a specific window across all cache keys.
Used for tab-death cleanup.

#### Parameters

##### windowId

`string`

#### Returns

`Promise`\<`void`\>

---

### releaseForWindow()

> **releaseForWindow**(`key`, `windowId`): `void`

Release a hold on a cache key for a specific window.
If this was the last window holding the key, the persisted holdCount drops to 0.
Ephemeral keys are auto-evicted when the last hold is released.

#### Parameters

##### key

`string`

##### windowId

`string`

#### Returns

`void`

#### Implementation of

`ICacheManagerInternal.releaseForWindow`

---

### releaseHolds()

> **releaseHolds**(`keys`): `void`

Release all holds on the given cache keys across all windows.
Used by QueryManager.destroy() to clean up without knowing window IDs.

#### Parameters

##### keys

`string`[]

#### Returns

`void`

#### Implementation of

`ICacheManagerInternal.releaseHolds`

---

### resolvePendingKeys()

> **resolvePendingKeys**(`commandId`, `idMap`, `resolveCacheKey?`): `void`

Resolve pending cache keys when a command succeeds with ID mappings.
Called by CommandQueue after reconcileCreateIds.

#### Parameters

##### commandId

`string`

The succeeded command's ID

##### idMap

`Record`\<`string`, \{ `serverId`: `string`; \}\>

clientId → serverId mappings

##### resolveCacheKey?

(`cacheKey`) => [`CacheKeyIdentity`](../type-aliases/CacheKeyIdentity.md)\<`TLink`\>

Optional custom resolver from command handler registration

#### Returns

`void`

#### Implementation of

`ICacheManagerInternal.resolvePendingKeys`

---

### setCommandQueue()

> **setCommandQueue**(`commandQueue`): `void`

Set the CommandQueue reference for synchronous id mapping lookup.
Called after construction by the orchestrator to break the circular dependency.

#### Parameters

##### commandQueue

`ICommandQueueInternal`\<`TLink`, `TCommand`\>

#### Returns

`void`

---

### setWriteQueue()

> **setWriteQueue**(`writeQueue`): `void`

Set the WriteQueue reference for dirty flush scheduling.
Called after construction by the orchestrator.

#### Parameters

##### writeQueue

`IWriteQueue`\<`TLink`, `TCommand`\>

#### Returns

`void`

---

### touch()

> **touch**(`cacheKey`): `Promise`\<`void`\>

Touch a cache key to update its access time.
Creates the key if it does not exist (spec §2.5.1).
Does not place a hold.

#### Parameters

##### cacheKey

[`CacheKeyIdentity`](../type-aliases/CacheKeyIdentity.md)\<`TLink`\>

Cache key identity

#### Returns

`Promise`\<`void`\>

#### Implementation of

`ICacheManagerInternal.touch`

---

### unfreeze()

> **unfreeze**(`key`): `Promise`\<`void`\>

Unfreeze a cache key.

#### Parameters

##### key

`string`

Cache key UUID

#### Returns

`Promise`\<`void`\>

#### Implementation of

`ICacheManagerInternal.unfreeze`

---

### unregisterWindow()

> **unregisterWindow**(`windowId`): `Promise`\<`void`\>

Unregister a window, releasing all its holds.

#### Parameters

##### windowId

`string`

#### Returns

`Promise`\<`void`\>

#### Implementation of

`ICacheManagerInternal.unregisterWindow`
