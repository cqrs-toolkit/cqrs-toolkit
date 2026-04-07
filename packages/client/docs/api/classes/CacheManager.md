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

- [`ICacheManager`](../interfaces/ICacheManager.md)\<`TLink`\>

## Constructors

### Constructor

> **new CacheManager**\<`TLink`, `TCommand`\>(`storage`, `eventBus`, `config`): `CacheManager`\<`TLink`, `TCommand`\>

#### Parameters

##### storage

[`IStorage`](../interfaces/IStorage.md)\<`TLink`, `TCommand`\>

##### eventBus

[`EventBus`](EventBus.md)\<`TLink`\>

##### config

[`CacheManagerConfig`](../interfaces/CacheManagerConfig.md)

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

[`ICacheManager`](../interfaces/ICacheManager.md).[`acquire`](../interfaces/ICacheManager.md#acquire)

---

### acquireKey()

> **acquireKey**(`cacheKey`, `options?`): `Promise`\<[`CacheKeyIdentity`](../type-aliases/CacheKeyIdentity.md)\<`TLink`\>\>

Acquire a cache key identity. Creates the cache key in storage if it doesn't exist.
Returns the full identity object with the derived UUID key and all source data.

#### Parameters

##### cacheKey

[`CacheKeyIdentity`](../type-aliases/CacheKeyIdentity.md)\<`TLink`\>

##### options?

[`AcquireCacheKeyOptions`](../interfaces/AcquireCacheKeyOptions.md)

#### Returns

`Promise`\<[`CacheKeyIdentity`](../type-aliases/CacheKeyIdentity.md)\<`TLink`\>\>

#### Implementation of

[`ICacheManager`](../interfaces/ICacheManager.md).[`acquireKey`](../interfaces/ICacheManager.md#acquirekey)

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

[`ICacheManager`](../interfaces/ICacheManager.md).[`evict`](../interfaces/ICacheManager.md#evict)

---

### evictAll()

> **evictAll**(): `Promise`\<`number`\>

Evict all evictable cache keys.

#### Returns

`Promise`\<`number`\>

Number of cache keys evicted

#### Implementation of

[`ICacheManager`](../interfaces/ICacheManager.md).[`evictAll`](../interfaces/ICacheManager.md#evictall)

---

### evictExpired()

> **evictExpired**(): `Promise`\<`number`\>

Evict expired cache keys.

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

Cache key UUID

#### Returns

`Promise`\<`boolean`\>

Whether the cache key exists

#### Implementation of

[`ICacheManager`](../interfaces/ICacheManager.md).[`exists`](../interfaces/ICacheManager.md#exists)

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

[`ICacheManager`](../interfaces/ICacheManager.md).[`filterExistingCacheKeys`](../interfaces/ICacheManager.md#filterexistingcachekeys)

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

[`ICacheManager`](../interfaces/ICacheManager.md).[`freeze`](../interfaces/ICacheManager.md#freeze)

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

Cache key UUID

#### Returns

`Promise`\<`boolean`\>

Whether the cache key is frozen

#### Implementation of

[`ICacheManager`](../interfaces/ICacheManager.md).[`isFrozen`](../interfaces/ICacheManager.md#isfrozen)

---

### onSessionDestroyed()

> **onSessionDestroyed**(): `Promise`\<`void`\>

Handle session destroyed — clears all cache state.

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

#### Returns

`boolean`

---

### release()

> **release**(`key`): `Promise`\<`void`\>

Release a hold on a cache key for this window.
If this was the last window holding the key, the persisted holdCount drops to 0.
Ephemeral keys are auto-evicted when the last hold is released.

#### Parameters

##### key

`string`

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

#### Returns

`Promise`\<`void`\>

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

[`ICacheManager`](../interfaces/ICacheManager.md).[`touch`](../interfaces/ICacheManager.md#touch)

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

[`ICacheManager`](../interfaces/ICacheManager.md).[`unfreeze`](../interfaces/ICacheManager.md#unfreeze)

---

### unregisterWindow()

> **unregisterWindow**(`windowId`): `Promise`\<`void`\>

Unregister a window, releasing all its holds.

#### Parameters

##### windowId

`string`

#### Returns

`Promise`\<`void`\>
