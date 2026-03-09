[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / ICacheManager

# Interface: ICacheManager

Cache manager interface.
Provides cache key lifecycle, eviction, and hold management.

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

[`AcquireCacheKeyOptions`](AcquireCacheKeyOptions.md)

Acquisition options

#### Returns

`Promise`\<`string`\>

Cache key identifier

---

### evict()

> **evict**(`key`): `Promise`\<`boolean`\>

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

Evict all evictable cache keys.

#### Returns

`Promise`\<`number`\>

Number of cache keys evicted

---

### evictExpired()

> **evictExpired**(): `Promise`\<`number`\>

Evict expired cache keys.

#### Returns

`Promise`\<`number`\>

Number of cache keys evicted

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

---

### freeze()

> **freeze**(`key`): `Promise`\<`void`\>

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

Get the number of cache keys.

#### Returns

`Promise`\<`number`\>

Total cache key count

---

### hold()

> **hold**(`key`): `Promise`\<`void`\>

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

Unfreeze a cache key.

#### Parameters

##### key

`string`

Cache key identifier

#### Returns

`Promise`\<`void`\>
