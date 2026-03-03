[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../README.md) / IStorage

# Interface: IStorage

Defined in: packages/client/src/storage/IStorage.ts:100

Storage interface.
All methods are async to support both sync (in-memory) and async (SQLite) backends.

## Methods

### beginTransaction()?

> `optional` **beginTransaction**(): `Promise`\<`unknown`\>

Defined in: packages/client/src/storage/IStorage.ts:313

Begin a transaction.
Returns a transaction handle that can be passed to other methods.

#### Returns

`Promise`\<`unknown`\>

---

### clear()

> **clear**(): `Promise`\<`void`\>

Defined in: packages/client/src/storage/IStorage.ts:116

Clear all data from storage.

#### Returns

`Promise`\<`void`\>

---

### close()

> **close**(): `Promise`\<`void`\>

Defined in: packages/client/src/storage/IStorage.ts:111

Close the storage backend and release resources.

#### Returns

`Promise`\<`void`\>

---

### commitTransaction()?

> `optional` **commitTransaction**(`tx`): `Promise`\<`void`\>

Defined in: packages/client/src/storage/IStorage.ts:318

Commit a transaction.

#### Parameters

##### tx

`unknown`

#### Returns

`Promise`\<`void`\>

---

### deleteAllCommands()

> **deleteAllCommands**(): `Promise`\<`void`\>

Defined in: packages/client/src/storage/IStorage.ts:219

Delete all commands (e.g., on session clear).

#### Returns

`Promise`\<`void`\>

---

### deleteAnticipatedEventsByCommand()

> **deleteAnticipatedEventsByCommand**(`commandId`): `Promise`\<`void`\>

Defined in: packages/client/src/storage/IStorage.ts:260

Delete all anticipated events for a command.

#### Parameters

##### commandId

`string`

#### Returns

`Promise`\<`void`\>

---

### deleteCachedEvent()

> **deleteCachedEvent**(`id`): `Promise`\<`void`\>

Defined in: packages/client/src/storage/IStorage.ts:255

Delete a cached event.

#### Parameters

##### id

`string`

#### Returns

`Promise`\<`void`\>

---

### deleteCachedEventsByCacheKey()

> **deleteCachedEventsByCacheKey**(`cacheKey`): `Promise`\<`void`\>

Defined in: packages/client/src/storage/IStorage.ts:265

Delete all cached events for a cache key.

#### Parameters

##### cacheKey

`string`

#### Returns

`Promise`\<`void`\>

---

### deleteCacheKey()

> **deleteCacheKey**(`key`): `Promise`\<`void`\>

Defined in: packages/client/src/storage/IStorage.ts:158

Delete a cache key and all associated data.

#### Parameters

##### key

`string`

#### Returns

`Promise`\<`void`\>

---

### deleteCommand()

> **deleteCommand**(`commandId`): `Promise`\<`void`\>

Defined in: packages/client/src/storage/IStorage.ts:214

Delete a command.

#### Parameters

##### commandId

`string`

#### Returns

`Promise`\<`void`\>

---

### deleteReadModel()

> **deleteReadModel**(`collection`, `id`): `Promise`\<`void`\>

Defined in: packages/client/src/storage/IStorage.ts:296

Delete a read model record.

#### Parameters

##### collection

`string`

##### id

`string`

#### Returns

`Promise`\<`void`\>

---

### deleteReadModelsByCacheKey()

> **deleteReadModelsByCacheKey**(`cacheKey`): `Promise`\<`void`\>

Defined in: packages/client/src/storage/IStorage.ts:301

Delete all read model records for a cache key.

#### Parameters

##### cacheKey

`string`

#### Returns

`Promise`\<`void`\>

---

### deleteReadModelsByCollection()

> **deleteReadModelsByCollection**(`collection`): `Promise`\<`void`\>

Defined in: packages/client/src/storage/IStorage.ts:306

Delete all read model records for a collection.

#### Parameters

##### collection

`string`

#### Returns

`Promise`\<`void`\>

---

### deleteSession()

> **deleteSession**(): `Promise`\<`void`\>

Defined in: packages/client/src/storage/IStorage.ts:132

Delete the current session and all associated data.

#### Returns

`Promise`\<`void`\>

---

### getAllCacheKeys()

> **getAllCacheKeys**(): `Promise`\<[`CacheKeyRecord`](CacheKeyRecord.md)[]\>

Defined in: packages/client/src/storage/IStorage.ts:148

Get all cache keys.

#### Returns

`Promise`\<[`CacheKeyRecord`](CacheKeyRecord.md)[]\>

---

### getAnticipatedEventsByCommand()

> **getAnticipatedEventsByCommand**(`commandId`): `Promise`\<[`CachedEventRecord`](CachedEventRecord.md)[]\>

Defined in: packages/client/src/storage/IStorage.ts:240

Get anticipated events for a command.

#### Parameters

##### commandId

`string`

#### Returns

`Promise`\<[`CachedEventRecord`](CachedEventRecord.md)[]\>

---

### getCachedEvent()

> **getCachedEvent**(`id`): `Promise`\<[`CachedEventRecord`](CachedEventRecord.md) \| `null`\>

Defined in: packages/client/src/storage/IStorage.ts:225

Get a cached event by ID.

#### Parameters

##### id

`string`

#### Returns

`Promise`\<[`CachedEventRecord`](CachedEventRecord.md) \| `null`\>

---

### getCachedEventsByCacheKey()

> **getCachedEventsByCacheKey**(`cacheKey`): `Promise`\<[`CachedEventRecord`](CachedEventRecord.md)[]\>

Defined in: packages/client/src/storage/IStorage.ts:230

Get cached events for a cache key.

#### Parameters

##### cacheKey

`string`

#### Returns

`Promise`\<[`CachedEventRecord`](CachedEventRecord.md)[]\>

---

### getCachedEventsByStream()

> **getCachedEventsByStream**(`streamId`): `Promise`\<[`CachedEventRecord`](CachedEventRecord.md)[]\>

Defined in: packages/client/src/storage/IStorage.ts:235

Get cached events for a stream.

#### Parameters

##### streamId

`string`

#### Returns

`Promise`\<[`CachedEventRecord`](CachedEventRecord.md)[]\>

---

### getCacheKey()

> **getCacheKey**(`key`): `Promise`\<[`CacheKeyRecord`](CacheKeyRecord.md) \| `null`\>

Defined in: packages/client/src/storage/IStorage.ts:143

Get a cache key record.

#### Parameters

##### key

`string`

#### Returns

`Promise`\<[`CacheKeyRecord`](CacheKeyRecord.md) \| `null`\>

---

### getCommand()

> **getCommand**(`commandId`): `Promise`\<[`CommandRecord`](CommandRecord.md)\<`unknown`, `unknown`\> \| `null`\>

Defined in: packages/client/src/storage/IStorage.ts:184

Get a command by ID.

#### Parameters

##### commandId

`string`

#### Returns

`Promise`\<[`CommandRecord`](CommandRecord.md)\<`unknown`, `unknown`\> \| `null`\>

---

### getCommands()

> **getCommands**(`filter?`): `Promise`\<[`CommandRecord`](CommandRecord.md)\<`unknown`, `unknown`\>[]\>

Defined in: packages/client/src/storage/IStorage.ts:189

Get commands matching a filter.

#### Parameters

##### filter?

[`CommandFilter`](CommandFilter.md)

#### Returns

`Promise`\<[`CommandRecord`](CommandRecord.md)\<`unknown`, `unknown`\>[]\>

---

### getCommandsBlockedBy()

> **getCommandsBlockedBy**(`commandId`): `Promise`\<[`CommandRecord`](CommandRecord.md)\<`unknown`, `unknown`\>[]\>

Defined in: packages/client/src/storage/IStorage.ts:199

Get commands blocked by a specific command.

#### Parameters

##### commandId

`string`

#### Returns

`Promise`\<[`CommandRecord`](CommandRecord.md)\<`unknown`, `unknown`\>[]\>

---

### getCommandsByStatus()

> **getCommandsByStatus**(`status`): `Promise`\<[`CommandRecord`](CommandRecord.md)\<`unknown`, `unknown`\>[]\>

Defined in: packages/client/src/storage/IStorage.ts:194

Get commands by status.

#### Parameters

##### status

[`CommandStatus`](../type-aliases/CommandStatus.md) | [`CommandStatus`](../type-aliases/CommandStatus.md)[]

#### Returns

`Promise`\<[`CommandRecord`](CommandRecord.md)\<`unknown`, `unknown`\>[]\>

---

### getEvictableCacheKeys()

> **getEvictableCacheKeys**(`limit`): `Promise`\<[`CacheKeyRecord`](CacheKeyRecord.md)[]\>

Defined in: packages/client/src/storage/IStorage.ts:178

Get cache keys eligible for eviction (holdCount = 0, not frozen).

#### Parameters

##### limit

`number`

#### Returns

`Promise`\<[`CacheKeyRecord`](CacheKeyRecord.md)[]\>

---

### getReadModel()

> **getReadModel**(`collection`, `id`): `Promise`\<[`ReadModelRecord`](ReadModelRecord.md) \| `null`\>

Defined in: packages/client/src/storage/IStorage.ts:271

Get a read model record.

#### Parameters

##### collection

`string`

##### id

`string`

#### Returns

`Promise`\<[`ReadModelRecord`](ReadModelRecord.md) \| `null`\>

---

### getReadModelsByCacheKey()

> **getReadModelsByCacheKey**(`cacheKey`): `Promise`\<[`ReadModelRecord`](ReadModelRecord.md)[]\>

Defined in: packages/client/src/storage/IStorage.ts:281

Get read model records by cache key.

#### Parameters

##### cacheKey

`string`

#### Returns

`Promise`\<[`ReadModelRecord`](ReadModelRecord.md)[]\>

---

### getReadModelsByCollection()

> **getReadModelsByCollection**(`collection`, `options?`): `Promise`\<[`ReadModelRecord`](ReadModelRecord.md)[]\>

Defined in: packages/client/src/storage/IStorage.ts:276

Get all read model records for a collection.

#### Parameters

##### collection

`string`

##### options?

[`QueryOptions`](QueryOptions.md)

#### Returns

`Promise`\<[`ReadModelRecord`](ReadModelRecord.md)[]\>

---

### getSession()

> **getSession**(): `Promise`\<[`SessionRecord`](SessionRecord.md) \| `null`\>

Defined in: packages/client/src/storage/IStorage.ts:122

Get the current session, if any.

#### Returns

`Promise`\<[`SessionRecord`](SessionRecord.md) \| `null`\>

---

### holdCacheKey()

> **holdCacheKey**(`key`): `Promise`\<`void`\>

Defined in: packages/client/src/storage/IStorage.ts:163

Increment hold count for a cache key.

#### Parameters

##### key

`string`

#### Returns

`Promise`\<`void`\>

---

### initialize()

> **initialize**(): `Promise`\<`void`\>

Defined in: packages/client/src/storage/IStorage.ts:106

Initialize the storage backend.
For SQLite, this creates tables and runs migrations.

#### Returns

`Promise`\<`void`\>

---

### releaseCacheKey()

> **releaseCacheKey**(`key`): `Promise`\<`void`\>

Defined in: packages/client/src/storage/IStorage.ts:168

Decrement hold count for a cache key.

#### Parameters

##### key

`string`

#### Returns

`Promise`\<`void`\>

---

### rollbackTransaction()?

> `optional` **rollbackTransaction**(`tx`): `Promise`\<`void`\>

Defined in: packages/client/src/storage/IStorage.ts:323

Rollback a transaction.

#### Parameters

##### tx

`unknown`

#### Returns

`Promise`\<`void`\>

---

### saveCachedEvent()

> **saveCachedEvent**(`event`): `Promise`\<`void`\>

Defined in: packages/client/src/storage/IStorage.ts:245

Save a cached event.

#### Parameters

##### event

[`CachedEventRecord`](CachedEventRecord.md)

#### Returns

`Promise`\<`void`\>

---

### saveCachedEvents()

> **saveCachedEvents**(`events`): `Promise`\<`void`\>

Defined in: packages/client/src/storage/IStorage.ts:250

Save multiple cached events in a batch.

#### Parameters

##### events

[`CachedEventRecord`](CachedEventRecord.md)[]

#### Returns

`Promise`\<`void`\>

---

### saveCacheKey()

> **saveCacheKey**(`record`): `Promise`\<`void`\>

Defined in: packages/client/src/storage/IStorage.ts:153

Save or update a cache key.

#### Parameters

##### record

[`CacheKeyRecord`](CacheKeyRecord.md)

#### Returns

`Promise`\<`void`\>

---

### saveCommand()

> **saveCommand**(`command`): `Promise`\<`void`\>

Defined in: packages/client/src/storage/IStorage.ts:204

Save a new command.

#### Parameters

##### command

[`CommandRecord`](CommandRecord.md)

#### Returns

`Promise`\<`void`\>

---

### saveReadModel()

> **saveReadModel**(`record`): `Promise`\<`void`\>

Defined in: packages/client/src/storage/IStorage.ts:286

Save a read model record.

#### Parameters

##### record

[`ReadModelRecord`](ReadModelRecord.md)

#### Returns

`Promise`\<`void`\>

---

### saveReadModels()

> **saveReadModels**(`records`): `Promise`\<`void`\>

Defined in: packages/client/src/storage/IStorage.ts:291

Save multiple read model records in a batch.

#### Parameters

##### records

[`ReadModelRecord`](ReadModelRecord.md)[]

#### Returns

`Promise`\<`void`\>

---

### saveSession()

> **saveSession**(`session`): `Promise`\<`void`\>

Defined in: packages/client/src/storage/IStorage.ts:127

Save or update the session.

#### Parameters

##### session

[`SessionRecord`](SessionRecord.md)

#### Returns

`Promise`\<`void`\>

---

### touchCacheKey()

> **touchCacheKey**(`key`): `Promise`\<`void`\>

Defined in: packages/client/src/storage/IStorage.ts:173

Touch a cache key (update lastAccessedAt).

#### Parameters

##### key

`string`

#### Returns

`Promise`\<`void`\>

---

### touchSession()

> **touchSession**(): `Promise`\<`void`\>

Defined in: packages/client/src/storage/IStorage.ts:137

Update the last seen timestamp.

#### Returns

`Promise`\<`void`\>

---

### updateCommand()

> **updateCommand**(`commandId`, `updates`): `Promise`\<`void`\>

Defined in: packages/client/src/storage/IStorage.ts:209

Update an existing command.

#### Parameters

##### commandId

`string`

##### updates

`Partial`\<[`CommandRecord`](CommandRecord.md)\>

#### Returns

`Promise`\<`void`\>
