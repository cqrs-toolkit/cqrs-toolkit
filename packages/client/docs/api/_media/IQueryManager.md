[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / IQueryManager

# Interface: IQueryManager\<TLink\>

Query manager interface.
Provides read-only access to cached data with cache key management.

Parameterized on `TLink` so multi-service apps get typed cache key identities
in query results.

## Type Parameters

### TLink

`TLink` _extends_ `Link`

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

> **getById**\<`T`\>(`params`): `Promise`\<[`QueryResult`](QueryResult.md)\<`TLink`, `T`\>\>

Get a single entity by ID.

#### Type Parameters

##### T

`T`

#### Parameters

##### params

[`GetByIdParams`](GetByIdParams.md)\<`TLink`\>

#### Returns

`Promise`\<[`QueryResult`](QueryResult.md)\<`TLink`, `T`\>\>

Query result

---

### getByIds()

> **getByIds**\<`T`\>(`params`): `Promise`\<`Map`\<`string`, [`QueryResult`](QueryResult.md)\<`TLink`, `T`\>\>\>

Get multiple entities by IDs.

#### Type Parameters

##### T

`T`

#### Parameters

##### params

[`GetByIdsParams`](GetByIdsParams.md)\<`TLink`\>

#### Returns

`Promise`\<`Map`\<`string`, [`QueryResult`](QueryResult.md)\<`TLink`, `T`\>\>\>

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

---

### list()

> **list**\<`T`\>(`params`): `Promise`\<[`ListQueryResult`](ListQueryResult.md)\<`TLink`, `T`\>\>

List entities in a collection.

#### Type Parameters

##### T

`T`

#### Parameters

##### params

[`ListParams`](ListParams.md)\<`TLink`\>

#### Returns

`Promise`\<[`ListQueryResult`](ListQueryResult.md)\<`TLink`, `T`\>\>

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

---

### releaseAll()

> **releaseAll**(): `Promise`\<`void`\>

Release all active holds.

#### Returns

`Promise`\<`void`\>

---

### touch()

> **touch**(`cacheKey`): `Promise`\<`void`\>

Touch a cache key to extend its lifetime.

#### Parameters

##### cacheKey

[`CacheKeyIdentity`](../type-aliases/CacheKeyIdentity.md)\<`TLink`\>

#### Returns

`Promise`\<`void`\>

---

### watchById()

> **watchById**\<`T`\>(`params`): `Observable`\<`T` \| `undefined`\>

Get an observable that emits when a specific entity changes.

#### Type Parameters

##### T

`T`

#### Parameters

##### params

[`GetByIdParams`](GetByIdParams.md)\<`TLink`\>

#### Returns

`Observable`\<`T` \| `undefined`\>

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
