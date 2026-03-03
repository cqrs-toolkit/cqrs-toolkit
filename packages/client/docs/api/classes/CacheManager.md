[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../README.md) / CacheManager

# Class: CacheManager

Defined in: packages/client/src/core/cache-manager/CacheManager.ts:40

Cache manager implementation.

## Constructors

### Constructor

> **new CacheManager**(`config`): `CacheManager`

Defined in: packages/client/src/core/cache-manager/CacheManager.ts:47

#### Parameters

##### config

[`CacheManagerConfig`](../interfaces/CacheManagerConfig.md)

#### Returns

`CacheManager`

## Methods

### acquire()

> **acquire**(`collection`, `params?`, `options?`): `Promise`\<`string`\>

Defined in: packages/client/src/core/cache-manager/CacheManager.ts:64

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

### evict()

> **evict**(`key`): `Promise`\<`boolean`\>

Defined in: packages/client/src/core/cache-manager/CacheManager.ts:200

Explicitly evict a cache key.
This will delete the cache key and all associated data.
Cannot evict frozen or held cache keys.

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

Defined in: packages/client/src/core/cache-manager/CacheManager.ts:225

Evict all evictable cache keys.
Used during session clear or manual cleanup.

#### Returns

`Promise`\<`number`\>

Number of cache keys evicted

---

### evictExpired()

> **evictExpired**(): `Promise`\<`number`\>

Defined in: packages/client/src/core/cache-manager/CacheManager.ts:273

Evict expired cache keys.
Should be called periodically (e.g., on activity).

#### Returns

`Promise`\<`number`\>

Number of cache keys evicted

---

### exists()

> **exists**(`key`): `Promise`\<`boolean`\>

Defined in: packages/client/src/core/cache-manager/CacheManager.ts:113

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

Defined in: packages/client/src/core/cache-manager/CacheManager.ts:162

Freeze a cache key.
While frozen, no changes can be made to data under this cache key.

#### Parameters

##### key

`string`

Cache key identifier

#### Returns

`Promise`\<`void`\>

---

### get()

> **get**(`key`): `Promise`\<[`CacheKeyRecord`](../interfaces/CacheKeyRecord.md) \| `null`\>

Defined in: packages/client/src/core/cache-manager/CacheManager.ts:124

Get a cache key record.

#### Parameters

##### key

`string`

Cache key identifier

#### Returns

`Promise`\<[`CacheKeyRecord`](../interfaces/CacheKeyRecord.md) \| `null`\>

Cache key record or null

---

### getCount()

> **getCount**(): `Promise`\<`number`\>

Defined in: packages/client/src/core/cache-manager/CacheManager.ts:243

Get the number of cache keys.

#### Returns

`Promise`\<`number`\>

Total cache key count

---

### hold()

> **hold**(`key`): `Promise`\<`void`\>

Defined in: packages/client/src/core/cache-manager/CacheManager.ts:143

Place a hold on a cache key.
While held, the cache key cannot be evicted.

#### Parameters

##### key

`string`

Cache key identifier

#### Returns

`Promise`\<`void`\>

---

### isFrozen()

> **isFrozen**(`key`): `Promise`\<`boolean`\>

Defined in: packages/client/src/core/cache-manager/CacheManager.ts:187

Check if a cache key is frozen.

#### Parameters

##### key

`string`

Cache key identifier

#### Returns

`Promise`\<`boolean`\>

Whether the cache key is frozen

---

### release()

> **release**(`key`): `Promise`\<`void`\>

Defined in: packages/client/src/core/cache-manager/CacheManager.ts:152

Release a hold on a cache key.

#### Parameters

##### key

`string`

Cache key identifier

#### Returns

`Promise`\<`void`\>

---

### touch()

> **touch**(`key`): `Promise`\<`void`\>

Defined in: packages/client/src/core/cache-manager/CacheManager.ts:133

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

Defined in: packages/client/src/core/cache-manager/CacheManager.ts:174

Unfreeze a cache key.

#### Parameters

##### key

`string`

Cache key identifier

#### Returns

`Promise`\<`void`\>
