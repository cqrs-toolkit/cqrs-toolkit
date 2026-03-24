[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / ReadModelStore

# Class: ReadModelStore

Read model store implementation.

## Constructors

### Constructor

> **new ReadModelStore**(`config`): `ReadModelStore`

#### Parameters

##### config

[`ReadModelStoreConfig`](../interfaces/ReadModelStoreConfig.md)

#### Returns

`ReadModelStore`

## Methods

### applyLocalChanges()

> **applyLocalChanges**\<`T`\>(`collection`, `id`, `changes`, `cacheKey`): `Promise`\<`boolean`\>

Apply local changes to a read model (optimistic update).

#### Type Parameters

##### T

`T` _extends_ `object`

#### Parameters

##### collection

`string`

Collection name

##### id

`string`

Entity ID

##### changes

`Partial`\<`T`\>

Partial changes to apply

##### cacheKey

`string`

Cache key to associate with (required if creating new)

#### Returns

`Promise`\<`boolean`\>

---

### clearLocalChanges()

> **clearLocalChanges**(`collection`, `id`): `Promise`\<`void`\>

Clear local changes for a read model (revert to server baseline).

#### Parameters

##### collection

`string`

Collection name

##### id

`string`

Entity ID

#### Returns

`Promise`\<`void`\>

---

### count()

> **count**(`collection`): `Promise`\<`number`\>

Get the count of read models in a collection.

#### Parameters

##### collection

`string`

Collection name

#### Returns

`Promise`\<`number`\>

Count of read models

---

### delete()

> **delete**(`collection`, `id`): `Promise`\<`boolean`\>

Delete a read model.

#### Parameters

##### collection

`string`

Collection name

##### id

`string`

Entity ID

#### Returns

`Promise`\<`boolean`\>

---

### exists()

> **exists**(`collection`, `id`): `Promise`\<`boolean`\>

Check if a read model exists.

#### Parameters

##### collection

`string`

Collection name

##### id

`string`

Entity ID

#### Returns

`Promise`\<`boolean`\>

Whether the read model exists

---

### getById()

> **getById**\<`T`\>(`collection`, `id`): `Promise`\<[`ReadModel`](../interfaces/ReadModel.md)\<`T`\> \| `undefined`\>

Get a read model by ID.

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

`Promise`\<[`ReadModel`](../interfaces/ReadModel.md)\<`T`\> \| `undefined`\>

Read model or undefined

---

### getByIds()

> **getByIds**\<`T`\>(`collection`, `ids`): `Promise`\<`Map`\<`string`, [`ReadModel`](../interfaces/ReadModel.md)\<`T`\>\>\>

Get multiple read models by IDs.

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

#### Returns

`Promise`\<`Map`\<`string`, [`ReadModel`](../interfaces/ReadModel.md)\<`T`\>\>\>

Map of ID to read model

---

### getLocalChanges()

> **getLocalChanges**\<`T`\>(): `Promise`\<[`ReadModel`](../interfaces/ReadModel.md)\<`T`\>[]\>

Get all read models with local changes.

#### Type Parameters

##### T

`T`

#### Returns

`Promise`\<[`ReadModel`](../interfaces/ReadModel.md)\<`T`\>[]\>

Array of read models with uncommitted changes

---

### list()

> **list**\<`T`\>(`collection`, `options?`): `Promise`\<[`ReadModel`](../interfaces/ReadModel.md)\<`T`\>[]\>

List read models in a collection.

#### Type Parameters

##### T

`T`

#### Parameters

##### collection

`string`

Collection name

##### options?

[`ReadModelQueryOptions`](../interfaces/ReadModelQueryOptions.md)

Query options

#### Returns

`Promise`\<[`ReadModel`](../interfaces/ReadModel.md)\<`T`\>[]\>

Array of read models

---

### mergeServerData()

> **mergeServerData**\<`T`\>(`collection`, `id`, `data`, `cacheKey`): `Promise`\<`boolean`\>

Merge partial data into server baseline and recompute effective data via three-way merge.
Preserves local overlays that differ from the server baseline.

#### Type Parameters

##### T

`T` _extends_ `object`

#### Parameters

##### collection

`string`

Collection name

##### id

`string`

Entity ID

##### data

`Partial`\<`T`\>

Partial data to merge into server baseline

##### cacheKey

`string`

Cache key to associate with

#### Returns

`Promise`\<`boolean`\>

true if data changed

---

### setClientMetadata()

> **setClientMetadata**(`collection`, `id`, `metadata`): `Promise`\<`void`\>

Set client metadata on a read model entry.
Used to track the original client-generated ID through reconciliation.

#### Parameters

##### collection

`string`

Collection name

##### id

`string`

Entity ID

##### metadata

[`ClientMetadata`](../interfaces/ClientMetadata.md)

Client metadata to set

#### Returns

`Promise`\<`void`\>

---

### setLocalData()

> **setLocalData**\<`T`\>(`collection`, `id`, `data`, `cacheKey`): `Promise`\<`boolean`\>

Set local data as a full replacement of effective data (optimistic).
Preserves existing server baseline so future setServerData can three-way merge.

#### Type Parameters

##### T

`T` _extends_ `object`

#### Parameters

##### collection

`string`

Collection name

##### id

`string`

Entity ID

##### data

`T`

Complete read model data

##### cacheKey

`string`

Cache key to associate with

#### Returns

`Promise`\<`boolean`\>

true if data changed

---

### setServerData()

> **setServerData**\<`T`\>(`collection`, `id`, `data`, `cacheKey`): `Promise`\<`boolean`\>

Directly set a read model (used by sync/seeding).
Marks the data as server baseline.

#### Type Parameters

##### T

`T` _extends_ `object`

#### Parameters

##### collection

`string`

Collection name

##### id

`string`

Entity ID

##### data

`T`

Read model data

##### cacheKey

`string`

Cache key to associate with

#### Returns

`Promise`\<`boolean`\>
