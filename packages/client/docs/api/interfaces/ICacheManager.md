[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / ICacheManager

# Interface: ICacheManager

Defined in: packages/client/src/core/cache-manager/types.ts:25

Cache manager interface.
Provides cache key lifecycle, eviction, and hold management.

## Methods

### acquire()

> **acquire**(`collection`, `params?`, `options?`): `Promise`\<`string`\>

Defined in: packages/client/src/core/cache-manager/types.ts:35

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

[`AcquireCacheKeyOptions`](AcquireCacheKeyOptions.md)

Acquisition options

#### Returns

`Promise`\<`string`\>

Cache key identifier

---

### evict()

> **evict**(`key`): `Promise`\<`boolean`\>

Defined in: packages/client/src/core/cache-manager/types.ts:107

Explicitly evict a cache key.

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

Defined in: packages/client/src/core/cache-manager/types.ts:114

Evict all evictable cache keys.

#### Returns

`Promise`\<`number`\>

Number of cache keys evicted

---

### evictExpired()

> **evictExpired**(): `Promise`\<`number`\>

Defined in: packages/client/src/core/cache-manager/types.ts:121

Evict expired cache keys.

#### Returns

`Promise`\<`number`\>

Number of cache keys evicted

---

### exists()

> **exists**(`key`): `Promise`\<`boolean`\>

Defined in: packages/client/src/core/cache-manager/types.ts:47

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

Defined in: packages/client/src/core/cache-manager/types.ts:84

Freeze a cache key.

#### Parameters

##### key

`string`

Cache key identifier

#### Returns

`Promise`\<`void`\>

---

### get()

> **get**(`key`): `Promise`\<[`CacheKeyRecord`](CacheKeyRecord.md) \| `undefined`\>

Defined in: packages/client/src/core/cache-manager/types.ts:55

Get a cache key record.

#### Parameters

##### key

`string`

Cache key identifier

#### Returns

`Promise`\<[`CacheKeyRecord`](CacheKeyRecord.md) \| `undefined`\>

Cache key record or undefined

---

### getCount()

> **getCount**(): `Promise`\<`number`\>

Defined in: packages/client/src/core/cache-manager/types.ts:128

Get the number of cache keys.

#### Returns

`Promise`\<`number`\>

Total cache key count

---

### hold()

> **hold**(`key`): `Promise`\<`void`\>

Defined in: packages/client/src/core/cache-manager/types.ts:70

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

Defined in: packages/client/src/core/cache-manager/types.ts:99

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

Defined in: packages/client/src/core/cache-manager/types.ts:77

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

Defined in: packages/client/src/core/cache-manager/types.ts:62

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

Defined in: packages/client/src/core/cache-manager/types.ts:91

Unfreeze a cache key.

#### Parameters

##### key

`string`

Cache key identifier

#### Returns

`Promise`\<`void`\>
