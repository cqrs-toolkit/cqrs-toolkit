[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / CacheManager

# Class: CacheManager

Defined in: packages/client/src/core/cache-manager/CacheManager.ts:46

Cache manager implementation.

## Constructors

### Constructor

> **new CacheManager**(`config`): `CacheManager`

Defined in: packages/client/src/core/cache-manager/CacheManager.ts:61

#### Parameters

##### config

[`CacheManagerConfig`](../interfaces/CacheManagerConfig.md)

#### Returns

`CacheManager`

## Methods

### acquire()

> **acquire**(`collection`, `params?`, `options?`): `Promise`\<`string`\>

Defined in: packages/client/src/core/cache-manager/CacheManager.ts:105

Acquire a cache key for a collection with optional parameters.
Creates the cache key if it doesn't exist.

#### Parameters

##### collection

`string`

Collection name

##### params?

`Record`\<`string`, `unknown`\>

Optional query parameters

##### options?

[`AcquireCacheKeyOptions`](../interfaces/AcquireCacheKeyOptions.md)

Acquisition options

#### Returns

`Promise`\<`string`\>

Cache key identifier

---

### checkSessionUser()

> **checkSessionUser**(`userId`): `Promise`\<`boolean`\>

Defined in: packages/client/src/core/cache-manager/CacheManager.ts:398

Check for session/user mismatch. If the current session belongs to a
different user, wipes all cache keys and emits `cache:session-reset`.

#### Parameters

##### userId

`string`

Expected user identifier

#### Returns

`Promise`\<`boolean`\>

Whether a mismatch was detected and the cache was reset

---

### evict()

> **evict**(`key`): `Promise`\<`boolean`\>

Defined in: packages/client/src/core/cache-manager/CacheManager.ts:342

Explicitly evict a cache key.
This will delete the cache key and all associated data.
Cannot evict held cache keys. Cannot evict frozen persistent keys.
Ephemeral keys skip the frozen check (they can never be frozen).

#### Parameters

##### key

`string`

Cache key identifier

#### Returns

`Promise`\<`boolean`\>

Whether eviction succeeded

---

### evictAll()

> **evictAll**(): `Promise`\<`number`\>

Defined in: packages/client/src/core/cache-manager/CacheManager.ts:368

Evict all evictable cache keys.
Used during session clear or manual cleanup.

#### Returns

`Promise`\<`number`\>

Number of cache keys evicted

---

### evictExpired()

> **evictExpired**(): `Promise`\<`number`\>

Defined in: packages/client/src/core/cache-manager/CacheManager.ts:446

Evict expired cache keys.
Should be called periodically (e.g., on activity).

#### Returns

`Promise`\<`number`\>

Number of cache keys evicted

---

### exists()

> **exists**(`key`): `Promise`\<`boolean`\>

Defined in: packages/client/src/core/cache-manager/CacheManager.ts:156

Check if a cache key exists.

#### Parameters

##### key

`string`

Cache key identifier

#### Returns

`Promise`\<`boolean`\>

Whether the cache key exists

---

### freeze()

> **freeze**(`key`): `Promise`\<`void`\>

Defined in: packages/client/src/core/cache-manager/CacheManager.ts:303

Freeze a cache key.
While frozen, no changes can be made to data under this cache key.
Ephemeral keys cannot be frozen (no-op).

#### Parameters

##### key

`string`

Cache key identifier

#### Returns

`Promise`\<`void`\>

---

### get()

> **get**(`key`): `Promise`\<[`CacheKeyRecord`](../interfaces/CacheKeyRecord.md) \| `undefined`\>

Defined in: packages/client/src/core/cache-manager/CacheManager.ts:167

Get a cache key record.

#### Parameters

##### key

`string`

Cache key identifier

#### Returns

`Promise`\<[`CacheKeyRecord`](../interfaces/CacheKeyRecord.md) \| `undefined`\>

Cache key record or undefined

---

### getCount()

> **getCount**(): `Promise`\<`number`\>

Defined in: packages/client/src/core/cache-manager/CacheManager.ts:386

Get the number of cache keys.

#### Returns

`Promise`\<`number`\>

Total cache key count

---

### hold()

> **hold**(`key`): `Promise`\<`void`\>

Defined in: packages/client/src/core/cache-manager/CacheManager.ts:187

Place a hold on a cache key for this window.
While held by any window, the cache key cannot be evicted.
Idempotent: calling hold twice for the same window is a no-op.

#### Parameters

##### key

`string`

Cache key identifier

#### Returns

`Promise`\<`void`\>

---

### initialize()

> **initialize**(): `Promise`\<`void`\>

Defined in: packages/client/src/core/cache-manager/CacheManager.ts:75

Initialize the cache manager.
Resets all persisted hold counts, evicts ephemeral keys, and registers this window.

#### Returns

`Promise`\<`void`\>

---

### isFrozen()

> **isFrozen**(`key`): `Promise`\<`boolean`\>

Defined in: packages/client/src/core/cache-manager/CacheManager.ts:328

Check if a cache key is frozen.

#### Parameters

##### key

`string`

Cache key identifier

#### Returns

`Promise`\<`boolean`\>

Whether the cache key is frozen

---

### registerWindow()

> **registerWindow**(`windowId`): `boolean`

Defined in: packages/client/src/core/cache-manager/CacheManager.ts:269

Register a window for capacity tracking.
Returns false and emits event if at capacity.

#### Parameters

##### windowId

`string`

Window identifier to register

#### Returns

`boolean`

Whether registration succeeded

---

### release()

> **release**(`key`): `Promise`\<`void`\>

Defined in: packages/client/src/core/cache-manager/CacheManager.ts:213

Release a hold on a cache key for this window.
If this was the last window holding the key, the persisted holdCount drops to 0.
Ephemeral keys are auto-evicted when the last hold is released.

#### Parameters

##### key

`string`

Cache key identifier

#### Returns

`Promise`\<`void`\>

---

### releaseAllForWindow()

> **releaseAllForWindow**(`windowId`): `Promise`\<`void`\>

Defined in: packages/client/src/core/cache-manager/CacheManager.ts:240

Release all holds for a specific window across all cache keys.
Used for tab-death cleanup.

#### Parameters

##### windowId

`string`

Window identifier to release

#### Returns

`Promise`\<`void`\>

---

### touch()

> **touch**(`key`): `Promise`\<`void`\>

Defined in: packages/client/src/core/cache-manager/CacheManager.ts:176

Touch a cache key to update its access time.

#### Parameters

##### key

`string`

Cache key identifier

#### Returns

`Promise`\<`void`\>

---

### unfreeze()

> **unfreeze**(`key`): `Promise`\<`void`\>

Defined in: packages/client/src/core/cache-manager/CacheManager.ts:315

Unfreeze a cache key.

#### Parameters

##### key

`string`

Cache key identifier

#### Returns

`Promise`\<`void`\>

---

### unregisterWindow()

> **unregisterWindow**(`windowId`): `Promise`\<`void`\>

Defined in: packages/client/src/core/cache-manager/CacheManager.ts:291

Unregister a window, releasing all its holds.

#### Parameters

##### windowId

`string`

Window identifier to unregister

#### Returns

`Promise`\<`void`\>
