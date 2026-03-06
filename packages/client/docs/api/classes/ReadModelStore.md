[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / ReadModelStore

# Class: ReadModelStore

Defined in: [packages/client/src/core/read-model-store/ReadModelStore.ts:50](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/read-model-store/ReadModelStore.ts#L50)

Read model store implementation.

## Constructors

### Constructor

> **new ReadModelStore**(`config`): `ReadModelStore`

Defined in: [packages/client/src/core/read-model-store/ReadModelStore.ts:53](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/read-model-store/ReadModelStore.ts#L53)

#### Parameters

##### config

[`ReadModelStoreConfig`](../interfaces/ReadModelStoreConfig.md)

#### Returns

`ReadModelStore`

## Methods

### applyLocalChanges()

> **applyLocalChanges**\<`T`\>(`collection`, `id`, `changes`, `cacheKey`): `Promise`\<`boolean`\>

Defined in: [packages/client/src/core/read-model-store/ReadModelStore.ts:249](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/read-model-store/ReadModelStore.ts#L249)

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

Defined in: [packages/client/src/core/read-model-store/ReadModelStore.ts:405](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/read-model-store/ReadModelStore.ts#L405)

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

Defined in: [packages/client/src/core/read-model-store/ReadModelStore.ts:164](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/read-model-store/ReadModelStore.ts#L164)

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

Defined in: [packages/client/src/core/read-model-store/ReadModelStore.ts:429](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/read-model-store/ReadModelStore.ts#L429)

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

Defined in: [packages/client/src/core/read-model-store/ReadModelStore.ts:153](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/read-model-store/ReadModelStore.ts#L153)

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

Defined in: [packages/client/src/core/read-model-store/ReadModelStore.ts:64](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/read-model-store/ReadModelStore.ts#L64)

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

Defined in: [packages/client/src/core/read-model-store/ReadModelStore.ts:77](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/read-model-store/ReadModelStore.ts#L77)

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

Defined in: [packages/client/src/core/read-model-store/ReadModelStore.ts:128](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/read-model-store/ReadModelStore.ts#L128)

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

Defined in: [packages/client/src/core/read-model-store/ReadModelStore.ts:97](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/read-model-store/ReadModelStore.ts#L97)

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

Defined in: [packages/client/src/core/read-model-store/ReadModelStore.ts:332](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/read-model-store/ReadModelStore.ts#L332)

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

### setLocalData()

> **setLocalData**\<`T`\>(`collection`, `id`, `data`, `cacheKey`): `Promise`\<`boolean`\>

Defined in: [packages/client/src/core/read-model-store/ReadModelStore.ts:294](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/read-model-store/ReadModelStore.ts#L294)

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

Defined in: [packages/client/src/core/read-model-store/ReadModelStore.ts:178](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/read-model-store/ReadModelStore.ts#L178)

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
