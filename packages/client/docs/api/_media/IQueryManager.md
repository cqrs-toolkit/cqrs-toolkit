[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / IQueryManager

# Interface: IQueryManager

Query manager interface.
Provides read-only access to cached data with cache key management.

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

---

### destroy()

> **destroy**(): `Promise`\<`void`\>

Destroy the query manager and release resources.

#### Returns

`Promise`\<`void`\>

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

---

### getById()

> **getById**\<`T`\>(`collection`, `id`, `options?`): `Promise`\<[`QueryResult`](QueryResult.md)\<`T`\>\>

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

Release all active holds.

#### Returns

`Promise`\<`void`\>

---

### touch()

> **touch**(`collection`): `Promise`\<`void`\>

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

Get an observable that emits when data in a collection changes.

#### Parameters

##### collection

`string`

Collection name

#### Returns

`Observable`\<`string`[]\>

Observable of updated entity IDs
