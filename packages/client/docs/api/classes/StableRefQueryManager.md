[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / StableRefQueryManager

# Class: StableRefQueryManager

Defined in: [packages/client/src/core/query-manager/StableRefQueryManager.ts:44](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/query-manager/StableRefQueryManager.ts#L44)

Decorator around IQueryManager that preserves object references for
items whose (id, updatedAt) pair has not changed since the last query.

## Implements

- [`IQueryManager`](../interfaces/IQueryManager.md)

## Constructors

### Constructor

> **new StableRefQueryManager**(`inner`): `StableRefQueryManager`

Defined in: [packages/client/src/core/query-manager/StableRefQueryManager.ts:52](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/query-manager/StableRefQueryManager.ts#L52)

#### Parameters

##### inner

[`IQueryManager`](../interfaces/IQueryManager.md)

#### Returns

`StableRefQueryManager`

## Methods

### count()

> **count**(`collection`): `Promise`\<`number`\>

Defined in: [packages/client/src/core/query-manager/StableRefQueryManager.ts:174](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/query-manager/StableRefQueryManager.ts#L174)

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

Defined in: [packages/client/src/core/query-manager/StableRefQueryManager.ts:194](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/query-manager/StableRefQueryManager.ts#L194)

Destroy the query manager and release resources.

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IQueryManager`](../interfaces/IQueryManager.md).[`destroy`](../interfaces/IQueryManager.md#destroy)

---

### exists()

> **exists**(`collection`, `id`): `Promise`\<`boolean`\>

Defined in: [packages/client/src/core/query-manager/StableRefQueryManager.ts:170](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/query-manager/StableRefQueryManager.ts#L170)

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

Defined in: [packages/client/src/core/query-manager/StableRefQueryManager.ts:56](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/query-manager/StableRefQueryManager.ts#L56)

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

Defined in: [packages/client/src/core/query-manager/StableRefQueryManager.ts:78](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/query-manager/StableRefQueryManager.ts#L78)

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

Defined in: [packages/client/src/core/query-manager/StableRefQueryManager.ts:182](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/query-manager/StableRefQueryManager.ts#L182)

Place a hold on a cache key.

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

Defined in: [packages/client/src/core/query-manager/StableRefQueryManager.ts:106](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/query-manager/StableRefQueryManager.ts#L106)

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

### release()

> **release**(`cacheKey`): `Promise`\<`void`\>

Defined in: [packages/client/src/core/query-manager/StableRefQueryManager.ts:186](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/query-manager/StableRefQueryManager.ts#L186)

Release a hold on a cache key.

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

Defined in: [packages/client/src/core/query-manager/StableRefQueryManager.ts:190](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/query-manager/StableRefQueryManager.ts#L190)

Release all active holds.

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IQueryManager`](../interfaces/IQueryManager.md).[`releaseAll`](../interfaces/IQueryManager.md#releaseall)

---

### touch()

> **touch**(`collection`): `Promise`\<`void`\>

Defined in: [packages/client/src/core/query-manager/StableRefQueryManager.ts:178](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/query-manager/StableRefQueryManager.ts#L178)

Touch the cache key for a collection.

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

Defined in: [packages/client/src/core/query-manager/StableRefQueryManager.ts:149](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/query-manager/StableRefQueryManager.ts#L149)

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

Defined in: [packages/client/src/core/query-manager/StableRefQueryManager.ts:145](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/query-manager/StableRefQueryManager.ts#L145)

Get an observable that emits when data in a collection changes.

#### Parameters

##### collection

`string`

Collection name

#### Returns

`Observable`\<`string`[]\>

Observable of updated entity IDs

#### Implementation of

[`IQueryManager`](../interfaces/IQueryManager.md).[`watchCollection`](../interfaces/IQueryManager.md#watchcollection)
