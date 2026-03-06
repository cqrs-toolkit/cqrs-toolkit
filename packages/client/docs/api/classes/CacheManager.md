[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / CacheManager

# Class: CacheManager

Defined in: [packages/client/src/core/cache-manager/CacheManager.ts:36](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/cache-manager/CacheManager.ts#L36)

Cache manager implementation.

## Implements

- [`ICacheManager`](../interfaces/ICacheManager.md)

## Constructors

### Constructor

> **new CacheManager**(`config`): `CacheManager`

Defined in: [packages/client/src/core/cache-manager/CacheManager.ts:51](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/cache-manager/CacheManager.ts#L51)

#### Parameters

##### config

[`CacheManagerConfig`](../interfaces/CacheManagerConfig.md)

#### Returns

`CacheManager`

## Methods

### acquire()

> **acquire**(`collection`, `params?`, `options?`): `Promise`\<`string`\>

Defined in: [packages/client/src/core/cache-manager/CacheManager.ts:95](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/cache-manager/CacheManager.ts#L95)

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

Defined in: [packages/client/src/core/cache-manager/CacheManager.ts:388](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/cache-manager/CacheManager.ts#L388)

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

Defined in: [packages/client/src/core/cache-manager/CacheManager.ts:332](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/cache-manager/CacheManager.ts#L332)

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

Defined in: [packages/client/src/core/cache-manager/CacheManager.ts:358](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/cache-manager/CacheManager.ts#L358)

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

Defined in: [packages/client/src/core/cache-manager/CacheManager.ts:449](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/cache-manager/CacheManager.ts#L449)

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

Defined in: [packages/client/src/core/cache-manager/CacheManager.ts:146](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/cache-manager/CacheManager.ts#L146)

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

Defined in: [packages/client/src/core/cache-manager/CacheManager.ts:293](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/cache-manager/CacheManager.ts#L293)

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

Defined in: [packages/client/src/core/cache-manager/CacheManager.ts:157](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/cache-manager/CacheManager.ts#L157)

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

Defined in: [packages/client/src/core/cache-manager/CacheManager.ts:376](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/cache-manager/CacheManager.ts#L376)

Get the number of cache keys.

#### Returns

`Promise`\<`number`\>

Total cache key count

#### Implementation of

[`ICacheManager`](../interfaces/ICacheManager.md).[`getCount`](../interfaces/ICacheManager.md#getcount)

---

### hold()

> **hold**(`key`): `Promise`\<`void`\>

Defined in: [packages/client/src/core/cache-manager/CacheManager.ts:177](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/cache-manager/CacheManager.ts#L177)

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

Defined in: [packages/client/src/core/cache-manager/CacheManager.ts:65](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/cache-manager/CacheManager.ts#L65)

Initialize the cache manager.
Resets all persisted hold counts, evicts ephemeral keys, and registers this window.

#### Returns

`Promise`\<`void`\>

---

### isFrozen()

> **isFrozen**(`key`): `Promise`\<`boolean`\>

Defined in: [packages/client/src/core/cache-manager/CacheManager.ts:318](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/cache-manager/CacheManager.ts#L318)

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

Defined in: [packages/client/src/core/cache-manager/CacheManager.ts:415](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/cache-manager/CacheManager.ts#L415)

Handle session destroyed — wipe all cache keys and in-memory state.
Deletes each cache key via storage.deleteCacheKey() which cascade-deletes events + read models.

#### Returns

`Promise`\<`void`\>

---

### registerWindow()

> **registerWindow**(`windowId`): `boolean`

Defined in: [packages/client/src/core/cache-manager/CacheManager.ts:259](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/cache-manager/CacheManager.ts#L259)

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

Defined in: [packages/client/src/core/cache-manager/CacheManager.ts:203](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/cache-manager/CacheManager.ts#L203)

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

Defined in: [packages/client/src/core/cache-manager/CacheManager.ts:230](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/cache-manager/CacheManager.ts#L230)

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

Defined in: [packages/client/src/core/cache-manager/CacheManager.ts:166](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/cache-manager/CacheManager.ts#L166)

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

Defined in: [packages/client/src/core/cache-manager/CacheManager.ts:305](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/cache-manager/CacheManager.ts#L305)

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

Defined in: [packages/client/src/core/cache-manager/CacheManager.ts:281](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/cache-manager/CacheManager.ts#L281)

Unregister a window, releasing all its holds.

#### Parameters

##### windowId

`string`

Window identifier to unregister

#### Returns

`Promise`\<`void`\>
