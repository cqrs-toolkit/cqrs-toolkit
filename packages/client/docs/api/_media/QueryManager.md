[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / QueryManager

# Class: QueryManager

Defined in: packages/client/src/core/query-manager/QueryManager.ts:42

Query manager.

## Implements

- [`IQueryManager`](../interfaces/IQueryManager.md)

## Constructors

### Constructor

> **new QueryManager**(`config`): `QueryManager`

Defined in: packages/client/src/core/query-manager/QueryManager.ts:50

#### Parameters

##### config

[`QueryManagerConfig`](../interfaces/QueryManagerConfig.md)

#### Returns

`QueryManager`

## Methods

### count()

> **count**(`collection`): `Promise`\<`number`\>

Defined in: packages/client/src/core/query-manager/QueryManager.ts:202

Get the count of entities in a collection.

#### Parameters

##### collection

`string`

Collection name

#### Returns

`Promise`\<`number`\>

Count

#### Implementation of

[`IQueryManager`](../interfaces/IQueryManager.md).[`count`](../interfaces/IQueryManager.md#count)

---

### destroy()

> **destroy**(): `Promise`\<`void`\>

Defined in: packages/client/src/core/query-manager/QueryManager.ts:281

Destroy the query manager.

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IQueryManager`](../interfaces/IQueryManager.md).[`destroy`](../interfaces/IQueryManager.md#destroy)

---

### exists()

> **exists**(`collection`, `id`): `Promise`\<`boolean`\>

Defined in: packages/client/src/core/query-manager/QueryManager.ts:192

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

[`IQueryManager`](../interfaces/IQueryManager.md).[`exists`](../interfaces/IQueryManager.md#exists)

---

### getById()

> **getById**\<`T`\>(`collection`, `id`, `options?`): `Promise`\<[`QueryResult`](../interfaces/QueryResult.md)\<`T`\>\>

Defined in: packages/client/src/core/query-manager/QueryManager.ts:64

Get a single entity by ID.

#### Type Parameters

##### T

`T`

#### Parameters

##### collection

`string`

Collection name

##### id

`string`

Entity ID

##### options?

[`QueryManagerQueryOptions`](../interfaces/QueryManagerQueryOptions.md)

Query options

#### Returns

`Promise`\<[`QueryResult`](../interfaces/QueryResult.md)\<`T`\>\>

Query result

#### Implementation of

[`IQueryManager`](../interfaces/IQueryManager.md).[`getById`](../interfaces/IQueryManager.md#getbyid)

---

### getByIds()

> **getByIds**\<`T`\>(`collection`, `ids`, `options?`): `Promise`\<`Map`\<`string`, [`QueryResult`](../interfaces/QueryResult.md)\<`T`\>\>\>

Defined in: packages/client/src/core/query-manager/QueryManager.ts:91

Get multiple entities by IDs.

#### Type Parameters

##### T

`T`

#### Parameters

##### collection

`string`

Collection name

##### ids

`string`[]

Entity IDs

##### options?

[`QueryManagerQueryOptions`](../interfaces/QueryManagerQueryOptions.md)

Query options

#### Returns

`Promise`\<`Map`\<`string`, [`QueryResult`](../interfaces/QueryResult.md)\<`T`\>\>\>

Map of ID to query result

#### Implementation of

[`IQueryManager`](../interfaces/IQueryManager.md).[`getByIds`](../interfaces/IQueryManager.md#getbyids)

---

### hold()

> **hold**(`cacheKey`): `Promise`\<`void`\>

Defined in: packages/client/src/core/query-manager/QueryManager.ts:224

Place a hold on a cache key.
While held, the data cannot be evicted.
Only calls cacheManager.hold() on the 0→1 transition.

#### Parameters

##### cacheKey

`string`

Cache key to hold

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IQueryManager`](../interfaces/IQueryManager.md).[`hold`](../interfaces/IQueryManager.md#hold)

---

### list()

> **list**\<`T`\>(`collection`, `options?`): `Promise`\<[`ListQueryResult`](../interfaces/ListQueryResult.md)\<`T`\>\>

Defined in: packages/client/src/core/query-manager/QueryManager.ts:123

List entities in a collection.

#### Type Parameters

##### T

`T`

#### Parameters

##### collection

`string`

Collection name

##### options?

[`QueryManagerQueryOptions`](../interfaces/QueryManagerQueryOptions.md)

Query options

#### Returns

`Promise`\<[`ListQueryResult`](../interfaces/ListQueryResult.md)\<`T`\>\>

List query result

#### Implementation of

[`IQueryManager`](../interfaces/IQueryManager.md).[`list`](../interfaces/IQueryManager.md#list)

---

### onSessionDestroyed()

> **onSessionDestroyed**(): `void`

Defined in: packages/client/src/core/query-manager/QueryManager.ts:254

Handle session destroyed — clear all in-memory holds without calling cacheManager.release().
CacheManager state is already being wiped separately.

#### Returns

`void`

---

### release()

> **release**(`cacheKey`): `Promise`\<`void`\>

Defined in: packages/client/src/core/query-manager/QueryManager.ts:238

Release a hold on a cache key.
Only calls cacheManager.release() on the 1→0 transition.

#### Parameters

##### cacheKey

`string`

Cache key to release

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IQueryManager`](../interfaces/IQueryManager.md).[`release`](../interfaces/IQueryManager.md#release)

---

### releaseAll()

> **releaseAll**(): `Promise`\<`void`\>

Defined in: packages/client/src/core/query-manager/QueryManager.ts:271

Release all active holds.
One cacheManager.release() per key regardless of local count.

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IQueryManager`](../interfaces/IQueryManager.md).[`releaseAll`](../interfaces/IQueryManager.md#releaseall)

---

### releaseForCacheKey()

> **releaseForCacheKey**(`cacheKey`): `void`

Defined in: packages/client/src/core/query-manager/QueryManager.ts:263

Release hold tracking for an evicted cache key.
Removes the entry from activeHolds without calling cacheManager.release()
since the cache key has already been evicted from storage.

#### Parameters

##### cacheKey

`string`

#### Returns

`void`

---

### touch()

> **touch**(`collection`): `Promise`\<`void`\>

Defined in: packages/client/src/core/query-manager/QueryManager.ts:212

Touch the cache key for a collection.
Extends its lifetime in the cache.

#### Parameters

##### collection

`string`

Collection name

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IQueryManager`](../interfaces/IQueryManager.md).[`touch`](../interfaces/IQueryManager.md#touch)

---

### watchById()

> **watchById**\<`T`\>(`collection`, `id`): `Observable`\<`T` \| `undefined`\>

Defined in: packages/client/src/core/query-manager/QueryManager.ts:167

Get an observable that emits when a specific entity changes.

#### Type Parameters

##### T

`T`

#### Parameters

##### collection

`string`

Collection name

##### id

`string`

Entity ID

#### Returns

`Observable`\<`T` \| `undefined`\>

Observable of the entity data

#### Implementation of

[`IQueryManager`](../interfaces/IQueryManager.md).[`watchById`](../interfaces/IQueryManager.md#watchbyid)

---

### watchCollection()

> **watchCollection**(`collection`): `Observable`\<`string`[]\>

Defined in: packages/client/src/core/query-manager/QueryManager.ts:152

Get an observable that emits when data in a collection changes.
Use this for reactive UI updates.

#### Parameters

##### collection

`string`

Collection name

#### Returns

`Observable`\<`string`[]\>

Observable of update notifications

#### Implementation of

[`IQueryManager`](../interfaces/IQueryManager.md).[`watchCollection`](../interfaces/IQueryManager.md#watchcollection)
