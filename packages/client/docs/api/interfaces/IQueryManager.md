[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / IQueryManager

# Interface: IQueryManager

Defined in: packages/client/src/core/query-manager/types.ts:62

Query manager interface.
Provides read-only access to cached data with cache key management.

## Methods

### count()

> **count**(`collection`): `Promise`\<`number`\>

Defined in: packages/client/src/core/query-manager/types.ts:128

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

Defined in: packages/client/src/core/query-manager/types.ts:159

Destroy the query manager and release resources.

#### Returns

`Promise`\<`void`\>

---

### exists()

> **exists**(`collection`, `id`): `Promise`\<`boolean`\>

Defined in: packages/client/src/core/query-manager/types.ts:120

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

> **getById**\<`T`\>(`collection`, `id`, `options?`): `Promise`\<[`QueryResult`](QueryResult.md)\<`T`\>\>

Defined in: packages/client/src/core/query-manager/types.ts:71

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

[`QueryManagerQueryOptions`](QueryManagerQueryOptions.md)

Query options

#### Returns

`Promise`\<[`QueryResult`](QueryResult.md)\<`T`\>\>

Query result

---

### getByIds()

> **getByIds**\<`T`\>(`collection`, `ids`, `options?`): `Promise`\<`Map`\<`string`, [`QueryResult`](QueryResult.md)\<`T`\>\>\>

Defined in: packages/client/src/core/query-manager/types.ts:81

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

[`QueryManagerQueryOptions`](QueryManagerQueryOptions.md)

Query options

#### Returns

`Promise`\<`Map`\<`string`, [`QueryResult`](QueryResult.md)\<`T`\>\>\>

Map of ID to query result

---

### hold()

> **hold**(`cacheKey`): `Promise`\<`void`\>

Defined in: packages/client/src/core/query-manager/types.ts:142

Place a hold on a cache key.

#### Parameters

##### cacheKey

`string`

Cache key to hold

#### Returns

`Promise`\<`void`\>

---

### list()

> **list**\<`T`\>(`collection`, `options?`): `Promise`\<[`ListQueryResult`](ListQueryResult.md)\<`T`\>\>

Defined in: packages/client/src/core/query-manager/types.ts:94

List entities in a collection.

#### Type Parameters

##### T

`T`

#### Parameters

##### collection

`string`

Collection name

##### options?

[`QueryManagerQueryOptions`](QueryManagerQueryOptions.md)

Query options

#### Returns

`Promise`\<[`ListQueryResult`](ListQueryResult.md)\<`T`\>\>

List query result

---

### release()

> **release**(`cacheKey`): `Promise`\<`void`\>

Defined in: packages/client/src/core/query-manager/types.ts:149

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

Defined in: packages/client/src/core/query-manager/types.ts:154

Release all active holds.

#### Returns

`Promise`\<`void`\>

---

### touch()

> **touch**(`collection`): `Promise`\<`void`\>

Defined in: packages/client/src/core/query-manager/types.ts:135

Touch the cache key for a collection.

#### Parameters

##### collection

`string`

Collection name

#### Returns

`Promise`\<`void`\>

---

### watchById()

> **watchById**\<`T`\>(`collection`, `id`): `Observable`\<`T` \| `undefined`\>

Defined in: packages/client/src/core/query-manager/types.ts:111

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

Defined in: packages/client/src/core/query-manager/types.ts:102

Get an observable that emits when data in a collection changes.

#### Parameters

##### collection

`string`

Collection name

#### Returns

`Observable`\<`string`[]\>

Observable of updated entity IDs
