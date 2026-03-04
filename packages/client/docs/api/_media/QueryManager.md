[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / QueryManager

# Class: QueryManager

Defined in: packages/client/src/core/query-manager/QueryManager.ts:74

Query manager.

## Constructors

### Constructor

> **new QueryManager**(`config`): `QueryManager`

Defined in: packages/client/src/core/query-manager/QueryManager.ts:82

#### Parameters

##### config

[`QueryManagerConfig`](../interfaces/QueryManagerConfig.md)

#### Returns

`QueryManager`

## Methods

### count()

> **count**(`collection`): `Promise`\<`number`\>

Defined in: packages/client/src/core/query-manager/QueryManager.ts:234

Get the count of entities in a collection.

#### Parameters

##### collection

`string`

Collection name

#### Returns

`Promise`\<`number`\>

Count

---

### destroy()

> **destroy**(): `Promise`\<`void`\>

Defined in: packages/client/src/core/query-manager/QueryManager.ts:293

Destroy the query manager.

#### Returns

`Promise`\<`void`\>

---

### exists()

> **exists**(`collection`, `id`): `Promise`\<`boolean`\>

Defined in: packages/client/src/core/query-manager/QueryManager.ts:224

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

---

### getById()

> **getById**\<`T`\>(`collection`, `id`, `options?`): `Promise`\<[`QueryResult`](../interfaces/QueryResult.md)\<`T`\>\>

Defined in: packages/client/src/core/query-manager/QueryManager.ts:96

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

---

### getByIds()

> **getByIds**\<`T`\>(`collection`, `ids`, `options?`): `Promise`\<`Map`\<`string`, [`QueryResult`](../interfaces/QueryResult.md)\<`T`\>\>\>

Defined in: packages/client/src/core/query-manager/QueryManager.ts:123

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

---

### hold()

> **hold**(`cacheKey`): `Promise`\<`void`\>

Defined in: packages/client/src/core/query-manager/QueryManager.ts:255

Place a hold on a cache key.
While held, the data cannot be evicted.

#### Parameters

##### cacheKey

`string`

Cache key to hold

#### Returns

`Promise`\<`void`\>

---

### list()

> **list**\<`T`\>(`collection`, `options?`): `Promise`\<[`ListQueryResult`](../interfaces/ListQueryResult.md)\<`T`\>\>

Defined in: packages/client/src/core/query-manager/QueryManager.ts:155

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

---

### release()

> **release**(`cacheKey`): `Promise`\<`void`\>

Defined in: packages/client/src/core/query-manager/QueryManager.ts:266

Release a hold on a cache key.

#### Parameters

##### cacheKey

`string`

Cache key to release

#### Returns

`Promise`\<`void`\>

---

### releaseAll()

> **releaseAll**(): `Promise`\<`void`\>

Defined in: packages/client/src/core/query-manager/QueryManager.ts:281

Release all active holds.

#### Returns

`Promise`\<`void`\>

---

### touch()

> **touch**(`collection`): `Promise`\<`void`\>

Defined in: packages/client/src/core/query-manager/QueryManager.ts:244

Touch the cache key for a collection.
Extends its lifetime in the cache.

#### Parameters

##### collection

`string`

Collection name

#### Returns

`Promise`\<`void`\>

---

### watchById()

> **watchById**\<`T`\>(`collection`, `id`): `Observable`\<`T` \| `undefined`\>

Defined in: packages/client/src/core/query-manager/QueryManager.ts:199

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

---

### watchCollection()

> **watchCollection**(`collection`): `Observable`\<`string`[]\>

Defined in: packages/client/src/core/query-manager/QueryManager.ts:184

Get an observable that emits when data in a collection changes.
Use this for reactive UI updates.

#### Parameters

##### collection

`string`

Collection name

#### Returns

`Observable`\<`string`[]\>

Observable of update notifications
