[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../README.md) / ReadModelStore

# Class: ReadModelStore

Defined in: packages/client/src/core/read-model-store/ReadModelStore.ts:52

Read model store implementation.

## Constructors

### Constructor

> **new ReadModelStore**(`config`): `ReadModelStore`

Defined in: packages/client/src/core/read-model-store/ReadModelStore.ts:56

#### Parameters

##### config

[`ReadModelStoreConfig`](../interfaces/ReadModelStoreConfig.md)

#### Returns

`ReadModelStore`

## Methods

### applyLocalChanges()

> **applyLocalChanges**\<`T`\>(`collection`, `id`, `changes`, `cacheKey`): `Promise`\<`void`\>

Defined in: packages/client/src/core/read-model-store/ReadModelStore.ts:226

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

`Promise`\<`void`\>

---

### clearLocalChanges()

> **clearLocalChanges**(`collection`, `id`): `Promise`\<`void`\>

Defined in: packages/client/src/core/read-model-store/ReadModelStore.ts:261

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

Defined in: packages/client/src/core/read-model-store/ReadModelStore.ts:164

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

> **delete**(`collection`, `id`): `Promise`\<`void`\>

Defined in: packages/client/src/core/read-model-store/ReadModelStore.ts:285

Delete a read model.

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

### exists()

> **exists**(`collection`, `id`): `Promise`\<`boolean`\>

Defined in: packages/client/src/core/read-model-store/ReadModelStore.ts:153

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

> **getById**\<`T`\>(`collection`, `id`): `Promise`\<[`ReadModel`](../interfaces/ReadModel.md)\<`T`\> \| `null`\>

Defined in: packages/client/src/core/read-model-store/ReadModelStore.ts:68

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

`Promise`\<[`ReadModel`](../interfaces/ReadModel.md)\<`T`\> \| `null`\>

Read model or null

---

### getByIds()

> **getByIds**\<`T`\>(`collection`, `ids`): `Promise`\<`Map`\<`string`, [`ReadModel`](../interfaces/ReadModel.md)\<`T`\>\>\>

Defined in: packages/client/src/core/read-model-store/ReadModelStore.ts:81

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

Defined in: packages/client/src/core/read-model-store/ReadModelStore.ts:127

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

Defined in: packages/client/src/core/read-model-store/ReadModelStore.ts:101

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

### setServerData()

> **setServerData**\<`T`\>(`collection`, `id`, `data`, `cacheKey`): `Promise`\<`void`\>

Defined in: packages/client/src/core/read-model-store/ReadModelStore.ts:178

Directly set a read model (used by sync/seeding).
Marks the data as server baseline.

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

##### data

`T`

Read model data

##### cacheKey

`string`

Cache key to associate with

#### Returns

`Promise`\<`void`\>
