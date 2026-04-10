[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / ICacheManager

# Interface: ICacheManager\<TLink\>

Cache manager interface.
Provides cache key lifecycle, eviction, and hold management.

Parameterized on `TLink` so entity cache keys carry the app's link type
(`Link` for single-service, `ServiceLink` for multi-service).

## Type Parameters

### TLink

`TLink` _extends_ `Link`

## Methods

### acquire()

> **acquire**(`cacheKey`, `options?`): `Promise`\<`string`\>

Acquire a cache key, returning only the UUID string.
Convenience wrapper around [acquireKey](#acquirekey) for callers that only need the key.

#### Parameters

##### cacheKey

[`CacheKeyIdentity`](../type-aliases/CacheKeyIdentity.md)\<`TLink`\>

The cache key identity to acquire

##### options?

[`AcquireCacheKeyOptions`](AcquireCacheKeyOptions.md)

Acquisition options

#### Returns

`Promise`\<`string`\>

The cache key UUID string

---

### acquireKey()

> **acquireKey**(`cacheKey`, `options?`): `Promise`\<[`CacheKeyIdentity`](../type-aliases/CacheKeyIdentity.md)\<`TLink`\>\>

Acquire a cache key identity. Creates the cache key in storage if it doesn't exist.
Returns the full identity object with the derived UUID key and all source data.

#### Parameters

##### cacheKey

[`CacheKeyIdentity`](../type-aliases/CacheKeyIdentity.md)\<`TLink`\>

The cache key identity to acquire

##### options?

[`AcquireCacheKeyOptions`](AcquireCacheKeyOptions.md)

Acquisition options

#### Returns

`Promise`\<[`CacheKeyIdentity`](../type-aliases/CacheKeyIdentity.md)\<`TLink`\>\>

The acquired cache key identity

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

Cache key UUID

#### Returns

`Promise`\<`boolean`\>

Whether the cache key exists

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

---

### get()

> **get**(`key`): `Promise`\<[`CacheKeyRecord`](CacheKeyRecord.md) \| `undefined`\>

Get a cache key record.

#### Parameters

##### key

`string`

Cache key UUID

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

Cache key UUID

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

---

### registerCacheKey()

> **registerCacheKey**(`template`, `options?`): `Promise`\<[`CacheKeyIdentity`](../type-aliases/CacheKeyIdentity.md)\<`TLink`\>\>

Register a cache key from a template. Assigns a stable opaque UUID.
Auto-wires pending ID reconciliation from EntityRef values in the template.

For templates without EntityRef values, this is equivalent to acquireKey
with a deterministic identity.

#### Parameters

##### template

[`CacheKeyTemplate`](../type-aliases/CacheKeyTemplate.md)\<`TLink`\>

Cache key template (entity or scope)

##### options?

[`AcquireCacheKeyOptions`](AcquireCacheKeyOptions.md)

Acquisition options (hold, ttl, eviction policy)

#### Returns

`Promise`\<[`CacheKeyIdentity`](../type-aliases/CacheKeyIdentity.md)\<`TLink`\>\>

The registered cache key identity with a stable UUID

---

### release()

> **release**(`key`): `Promise`\<`void`\>

Release a hold on a cache key.

#### Parameters

##### key

`string`

Cache key UUID

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
