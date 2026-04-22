[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / StableRefQueryManager

# Class: StableRefQueryManager\<TLink\>

Decorator around IQueryManager that preserves object references for
items whose (id, updatedAt) pair has not changed since the last query.

## Type Parameters

### TLink

`TLink` _extends_ `Link`

## Implements

- [`IQueryManager`](../interfaces/IQueryManager.md)\<`TLink`\>

## Constructors

### Constructor

> **new StableRefQueryManager**\<`TLink`\>(`inner`): `StableRefQueryManager`\<`TLink`\>

#### Parameters

##### inner

[`IQueryManager`](../interfaces/IQueryManager.md)\<`TLink`\>

#### Returns

`StableRefQueryManager`\<`TLink`\>

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

[`IQueryManager`](../interfaces/IQueryManager.md).[`count`](../interfaces/IQueryManager.md#count)

---

### destroy()

> **destroy**(): `Promise`\<`void`\>

Destroy the query manager and release resources.

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IQueryManager`](../interfaces/IQueryManager.md).[`destroy`](../interfaces/IQueryManager.md#destroy)

---

### exists()

> **exists**(`collection`, `id`): `Promise`\<`boolean`\>

Check if an entity exists.

#### Parameters

##### collection

`string`

Collection name

##### id

[`EntityId`](../type-aliases/EntityId.md)

Entity ID

#### Returns

`Promise`\<`boolean`\>

Whether the entity exists

#### Implementation of

[`IQueryManager`](../interfaces/IQueryManager.md).[`exists`](../interfaces/IQueryManager.md#exists)

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

[`IQueryManager`](../interfaces/IQueryManager.md).[`getById`](../interfaces/IQueryManager.md#getbyid)

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

#### Implementation of

[`IQueryManager`](../interfaces/IQueryManager.md).[`getByIds`](../interfaces/IQueryManager.md#getbyids)

---

### getLocallyById()

> **getLocallyById**\<`T`\>(`collection`, `id`): `Promise`\<`T` \| `undefined`\>

Read a locally-cached read model by ID without triggering any client-side effects.

Unlike [IQueryManager.getById](../interfaces/IQueryManager.md#getbyid), this does not acquire a cache key,
register holds, emit events, or reconcile references.
It reads straight from the local read-model store and returns the data
if present, or `undefined` if the entity is not cached locally.

Use this for quick local lookups where a full query result
(with metadata and cache-key plumbing) is not needed.

#### Type Parameters

##### T

`T`

#### Parameters

##### collection

`string`

Collection name

##### id

[`EntityId`](../type-aliases/EntityId.md)

Entity ID

#### Returns

`Promise`\<`T` \| `undefined`\>

The cached data, or `undefined` if not present locally

#### Implementation of

[`IQueryManager`](../interfaces/IQueryManager.md).[`getLocallyById`](../interfaces/IQueryManager.md#getlocallybyid)

---

### hold()

> **hold**(`cacheKey`): `Promise`\<`void`\>

Place a hold on a cache key.

#### Parameters

##### cacheKey

`string`

Cache key UUID string

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IQueryManager`](../interfaces/IQueryManager.md).[`hold`](../interfaces/IQueryManager.md#hold)

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

#### Implementation of

[`IQueryManager`](../interfaces/IQueryManager.md).[`list`](../interfaces/IQueryManager.md#list)

---

### release()

> **release**(`cacheKey`): `Promise`\<`void`\>

Release a hold on a cache key.

#### Parameters

##### cacheKey

`string`

Cache key UUID string

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IQueryManager`](../interfaces/IQueryManager.md).[`release`](../interfaces/IQueryManager.md#release)

---

### releaseAll()

> **releaseAll**(): `Promise`\<`void`\>

Release all active holds.

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IQueryManager`](../interfaces/IQueryManager.md).[`releaseAll`](../interfaces/IQueryManager.md#releaseall)

---

### touch()

> **touch**(`cacheKey`): `Promise`\<`void`\>

Touch a cache key to extend its lifetime.

#### Parameters

##### cacheKey

[`CacheKeyIdentity`](../type-aliases/CacheKeyIdentity.md)\<`TLink`\>

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IQueryManager`](../interfaces/IQueryManager.md).[`touch`](../interfaces/IQueryManager.md#touch)

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

#### Implementation of

[`IQueryManager`](../interfaces/IQueryManager.md).[`watchById`](../interfaces/IQueryManager.md#watchbyid)

---

### watchCollection()

> **watchCollection**(`collection`): `Observable`\<[`CollectionSignal`](../type-aliases/CollectionSignal.md)\>

Get an observable of collection lifecycle signals.
Emits for data updates, seed completion, and sync failures.

#### Parameters

##### collection

`string`

Collection name

#### Returns

`Observable`\<[`CollectionSignal`](../type-aliases/CollectionSignal.md)\>

Observable of collection signals

#### Implementation of

[`IQueryManager`](../interfaces/IQueryManager.md).[`watchCollection`](../interfaces/IQueryManager.md#watchcollection)
