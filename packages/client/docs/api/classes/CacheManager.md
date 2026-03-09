[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / CacheManager

# Class: CacheManager

Cache manager implementation.

## Implements

- [`ICacheManager`](../interfaces/ICacheManager.md)

## Constructors

### Constructor

> **new CacheManager**(`config`): `CacheManager`

#### Parameters

##### config

[`CacheManagerConfig`](../interfaces/CacheManagerConfig.md)

#### Returns

`CacheManager`

## Methods

### acquire()

> **acquire**(`collection`, `params?`, `options?`): `Promise`\<`string`\>

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

#### Implementation of

[`ICacheManager`](../interfaces/ICacheManager.md).[`acquire`](../interfaces/ICacheManager.md#acquire)

---

### checkSessionUser()

> **checkSessionUser**(`userId`): `Promise`\<`boolean`\>

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

#### Implementation of

[`ICacheManager`](../interfaces/ICacheManager.md).[`evict`](../interfaces/ICacheManager.md#evict)

---

### evictAll()

> **evictAll**(): `Promise`\<`number`\>

Evict all evictable cache keys.
Used during session clear or manual cleanup.

#### Returns

`Promise`\<`number`\>

Number of cache keys evicted

#### Implementation of

[`ICacheManager`](../interfaces/ICacheManager.md).[`evictAll`](../interfaces/ICacheManager.md#evictall)

---

### evictExpired()

> **evictExpired**(): `Promise`\<`number`\>

Evict expired cache keys.
Should be called periodically (e.g., on activity).

#### Returns

`Promise`\<`number`\>

Number of cache keys evicted

#### Implementation of

[`ICacheManager`](../interfaces/ICacheManager.md).[`evictExpired`](../interfaces/ICacheManager.md#evictexpired)

---

### exists()

> **exists**(`key`): `Promise`\<`boolean`\>

Check if a cache key exists.

#### Parameters

##### key

`string`

Cache key identifier

#### Returns

`Promise`\<`boolean`\>

Whether the cache key exists

#### Implementation of

[`ICacheManager`](../interfaces/ICacheManager.md).[`exists`](../interfaces/ICacheManager.md#exists)

---

### freeze()

> **freeze**(`key`): `Promise`\<`void`\>

Freeze a cache key.
While frozen, no changes can be made to data under this cache key.
Ephemeral keys cannot be frozen (no-op).

#### Parameters

##### key

`string`

Cache key identifier

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`ICacheManager`](../interfaces/ICacheManager.md).[`freeze`](../interfaces/ICacheManager.md#freeze)

---

### get()

> **get**(`key`): `Promise`\<[`CacheKeyRecord`](../interfaces/CacheKeyRecord.md) \| `undefined`\>

Get a cache key record.

#### Parameters

##### key

`string`

Cache key identifier

#### Returns

`Promise`\<[`CacheKeyRecord`](../interfaces/CacheKeyRecord.md) \| `undefined`\>

Cache key record or undefined

#### Implementation of

[`ICacheManager`](../interfaces/ICacheManager.md).[`get`](../interfaces/ICacheManager.md#get)

---

### getCount()

> **getCount**(): `Promise`\<`number`\>

Get the number of cache keys.

#### Returns

`Promise`\<`number`\>

Total cache key count

#### Implementation of

[`ICacheManager`](../interfaces/ICacheManager.md).[`getCount`](../interfaces/ICacheManager.md#getcount)

---

### hold()

> **hold**(`key`): `Promise`\<`void`\>

Place a hold on a cache key for this window.
While held by any window, the cache key cannot be evicted.
Idempotent: calling hold twice for the same window is a no-op.

#### Parameters

##### key

`string`

Cache key identifier

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`ICacheManager`](../interfaces/ICacheManager.md).[`hold`](../interfaces/ICacheManager.md#hold)

---

### initialize()

> **initialize**(): `Promise`\<`void`\>

Initialize the cache manager.
Resets all persisted hold counts, evicts ephemeral keys, and registers this window.

#### Returns

`Promise`\<`void`\>

---

### isFrozen()

> **isFrozen**(`key`): `Promise`\<`boolean`\>

Check if a cache key is frozen.

#### Parameters

##### key

`string`

Cache key identifier

#### Returns

`Promise`\<`boolean`\>

Whether the cache key is frozen

#### Implementation of

[`ICacheManager`](../interfaces/ICacheManager.md).[`isFrozen`](../interfaces/ICacheManager.md#isfrozen)

---

### onSessionDestroyed()

> **onSessionDestroyed**(): `Promise`\<`void`\>

Handle session destroyed — wipe all cache keys and in-memory state.
Deletes each cache key via storage.deleteCacheKey() which cascade-deletes events + read models.

#### Returns

`Promise`\<`void`\>

---

### registerWindow()

> **registerWindow**(`windowId`): `boolean`

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

Release a hold on a cache key for this window.
If this was the last window holding the key, the persisted holdCount drops to 0.
Ephemeral keys are auto-evicted when the last hold is released.

#### Parameters

##### key

`string`

Cache key identifier

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`ICacheManager`](../interfaces/ICacheManager.md).[`release`](../interfaces/ICacheManager.md#release)

---

### releaseAllForWindow()

> **releaseAllForWindow**(`windowId`): `Promise`\<`void`\>

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

Touch a cache key to update its access time.

#### Parameters

##### key

`string`

Cache key identifier

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`ICacheManager`](../interfaces/ICacheManager.md).[`touch`](../interfaces/ICacheManager.md#touch)

---

### unfreeze()

> **unfreeze**(`key`): `Promise`\<`void`\>

Unfreeze a cache key.

#### Parameters

##### key

`string`

Cache key identifier

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`ICacheManager`](../interfaces/ICacheManager.md).[`unfreeze`](../interfaces/ICacheManager.md#unfreeze)

---

### unregisterWindow()

> **unregisterWindow**(`windowId`): `Promise`\<`void`\>

Unregister a window, releasing all its holds.

#### Parameters

##### windowId

`string`

Window identifier to unregister

#### Returns

`Promise`\<`void`\>
