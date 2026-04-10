[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / QueryManager

# Class: QueryManager\<TLink, TCommand\>

Query manager.

## Type Parameters

### TLink

`TLink` _extends_ `Link`

### TCommand

`TCommand` _extends_ [`EnqueueCommand`](../interfaces/EnqueueCommand.md)

## Implements

- `IQueryManagerInternal`\<`TLink`\>

## Constructors

### Constructor

> **new QueryManager**\<`TLink`, `TCommand`\>(`eventBus`, `cacheManager`, `readModelStore`): `QueryManager`\<`TLink`, `TCommand`\>

#### Parameters

##### eventBus

[`EventBus`](EventBus.md)\<`TLink`\>

##### cacheManager

`ICacheManagerInternal`\<`TLink`\>

##### readModelStore

[`ReadModelStore`](ReadModelStore.md)\<`TLink`, `TCommand`\>

#### Returns

`QueryManager`\<`TLink`, `TCommand`\>

## Methods

### count()

> **count**(`collection`): `Promise`\<`number`\>

Get the count of entities in a collection.

#### Parameters

##### collection

`string`

Collection name

#### Returns

`Promise`\<`number`\>

Count

#### Implementation of

`IQueryManagerInternal.count`

---

### destroy()

> **destroy**(): `Promise`\<`void`\>

Destroy the query manager.

#### Returns

`Promise`\<`void`\>

#### Implementation of

`IQueryManagerInternal.destroy`

---

### exists()

> **exists**(`collection`, `id`): `Promise`\<`boolean`\>

Check if an entity exists.

#### Parameters

##### collection

`string`

Collection name

##### id

`string`

Entity ID

#### Returns

`Promise`\<`boolean`\>

Whether the entity exists

#### Implementation of

`IQueryManagerInternal.exists`

---

### getById()

> **getById**\<`T`\>(`params`): `Promise`\<[`QueryResult`](../interfaces/QueryResult.md)\<`TLink`, `T`\>\>

Get a single entity by ID.

#### Type Parameters

##### T

`T`

#### Parameters

##### params

[`GetByIdParams`](../interfaces/GetByIdParams.md)\<`TLink`\>

#### Returns

`Promise`\<[`QueryResult`](../interfaces/QueryResult.md)\<`TLink`, `T`\>\>

Query result

#### Implementation of

`IQueryManagerInternal.getById`

---

### getByIds()

> **getByIds**\<`T`\>(`params`): `Promise`\<`Map`\<`string`, [`QueryResult`](../interfaces/QueryResult.md)\<`TLink`, `T`\>\>\>

Get multiple entities by IDs.

#### Type Parameters

##### T

`T`

#### Parameters

##### params

[`GetByIdsParams`](../interfaces/GetByIdsParams.md)\<`TLink`\>

#### Returns

`Promise`\<`Map`\<`string`, [`QueryResult`](../interfaces/QueryResult.md)\<`TLink`, `T`\>\>\>

Map of ID to query result

#### Implementation of

`IQueryManagerInternal.getByIds`

---

### hold()

> **hold**(`_cacheKey`): `Promise`\<`void`\>

Place a hold on a cache key.

#### Parameters

##### \_cacheKey

`string`

#### Returns

`Promise`\<`void`\>

#### Implementation of

`IQueryManagerInternal.hold`

---

### holdForWindow()

> **holdForWindow**(`cacheKey`, `windowId`): `void`

Place a hold on a cache key for a specific window.
Ref-counted — only calls cacheManager.holdForWindow() on the 0→1 transition.

#### Parameters

##### cacheKey

`string`

##### windowId

`string`

#### Returns

`void`

#### Implementation of

`IQueryManagerInternal.holdForWindow`

---

### list()

> **list**\<`T`\>(`params`): `Promise`\<[`ListQueryResult`](../interfaces/ListQueryResult.md)\<`TLink`, `T`\>\>

List entities in a collection.

#### Type Parameters

##### T

`T`

#### Parameters

##### params

[`ListParams`](../interfaces/ListParams.md)\<`TLink`\>

#### Returns

`Promise`\<[`ListQueryResult`](../interfaces/ListQueryResult.md)\<`TLink`, `T`\>\>

List query result

#### Implementation of

`IQueryManagerInternal.list`

---

### onSessionDestroyed()

> **onSessionDestroyed**(): `void`

Handle session destroyed — clear all in-memory holds without calling cacheManager.release().
CacheManager state is already being wiped separately.

#### Returns

`void`

#### Implementation of

`IQueryManagerInternal.onSessionDestroyed`

---

### release()

> **release**(`_cacheKey`): `Promise`\<`void`\>

Release a hold on a cache key.

#### Parameters

##### \_cacheKey

`string`

#### Returns

`Promise`\<`void`\>

#### Implementation of

`IQueryManagerInternal.release`

---

### releaseAll()

> **releaseAll**(): `Promise`\<`void`\>

Release all active holds.

#### Returns

`Promise`\<`void`\>

#### Implementation of

`IQueryManagerInternal.releaseAll`

---

### releaseAllForWindow()

> **releaseAllForWindow**(`windowId`): `void`

Release all holds for a specific window.

#### Parameters

##### windowId

`string`

#### Returns

`void`

#### Implementation of

`IQueryManagerInternal.releaseAllForWindow`

---

### releaseForCacheKey()

> **releaseForCacheKey**(`cacheKey`): `void`

Release hold tracking for an evicted cache key.
Removes the entry from activeHolds without calling cacheManager.release()
since the cache key has already been evicted from storage.

#### Parameters

##### cacheKey

`string`

#### Returns

`void`

#### Implementation of

`IQueryManagerInternal.releaseForCacheKey`

---

### releaseForWindow()

> **releaseForWindow**(`cacheKey`, `windowId`): `void`

Release a hold on a cache key for a specific window.
Ref-counted — only calls cacheManager.releaseForWindow() on the 1→0 transition.

#### Parameters

##### cacheKey

`string`

##### windowId

`string`

#### Returns

`void`

#### Implementation of

`IQueryManagerInternal.releaseForWindow`

---

### touch()

> **touch**(`cacheKey`): `Promise`\<`void`\>

Touch the cache key for a collection.
Extends its lifetime in the cache.

#### Parameters

##### cacheKey

[`CacheKeyIdentity`](../type-aliases/CacheKeyIdentity.md)\<`TLink`\>

#### Returns

`Promise`\<`void`\>

#### Implementation of

`IQueryManagerInternal.touch`

---

### watchById()

> **watchById**\<`T`\>(`params`): `Observable`\<`T` \| `undefined`\>

Get an observable that emits when a specific entity changes.

#### Type Parameters

##### T

`T`

#### Parameters

##### params

[`GetByIdParams`](../interfaces/GetByIdParams.md)\<`TLink`\>

#### Returns

`Observable`\<`T` \| `undefined`\>

Observable of the entity data

#### Implementation of

`IQueryManagerInternal.watchById`

---

### watchCollection()

> **watchCollection**(`collection`): `Observable`\<[`CollectionSignal`](../type-aliases/CollectionSignal.md)\>

Get an observable that emits when data in a collection changes.
Use this for reactive UI updates.

#### Parameters

##### collection

`string`

Collection name

#### Returns

`Observable`\<[`CollectionSignal`](../type-aliases/CollectionSignal.md)\>

Observable of update notifications

#### Implementation of

`IQueryManagerInternal.watchCollection`
