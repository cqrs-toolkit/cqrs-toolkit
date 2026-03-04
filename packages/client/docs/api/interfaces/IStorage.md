[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / IStorage

# Interface: IStorage

Defined in: packages/client/src/storage/IStorage.ts:102

Storage interface.
All methods are async to support both sync (in-memory) and async (SQLite) backends.

## Methods

### beginTransaction()?

> `optional` **beginTransaction**(): `Promise`\<`unknown`\>

Defined in: packages/client/src/storage/IStorage.ts:315

Begin a transaction.
Returns a transaction handle that can be passed to other methods.

#### Returns

`Promise`\<`unknown`\>

---

### clear()

> **clear**(): `Promise`\<`void`\>

Defined in: packages/client/src/storage/IStorage.ts:118

Clear all data from storage.

#### Returns

`Promise`\<`void`\>

---

### close()

> **close**(): `Promise`\<`void`\>

Defined in: packages/client/src/storage/IStorage.ts:113

Close the storage backend and release resources.

#### Returns

`Promise`\<`void`\>

---

### commitTransaction()?

> `optional` **commitTransaction**(`tx`): `Promise`\<`void`\>

Defined in: packages/client/src/storage/IStorage.ts:320

Commit a transaction.

#### Parameters

##### tx

`unknown`

#### Returns

`Promise`\<`void`\>

---

### deleteAllCommands()

> **deleteAllCommands**(): `Promise`\<`void`\>

Defined in: packages/client/src/storage/IStorage.ts:221

Delete all commands (e.g., on session clear).

#### Returns

`Promise`\<`void`\>

---

### deleteAnticipatedEventsByCommand()

> **deleteAnticipatedEventsByCommand**(`commandId`): `Promise`\<`void`\>

Defined in: packages/client/src/storage/IStorage.ts:262

Delete all anticipated events for a command.

#### Parameters

##### commandId

`string`

#### Returns

`Promise`\<`void`\>

---

### deleteCachedEvent()

> **deleteCachedEvent**(`id`): `Promise`\<`void`\>

Defined in: packages/client/src/storage/IStorage.ts:257

Delete a cached event.

#### Parameters

##### id

`string`

#### Returns

`Promise`\<`void`\>

---

### deleteCachedEventsByCacheKey()

> **deleteCachedEventsByCacheKey**(`cacheKey`): `Promise`\<`void`\>

Defined in: packages/client/src/storage/IStorage.ts:267

Delete all cached events for a cache key.

#### Parameters

##### cacheKey

`string`

#### Returns

`Promise`\<`void`\>

---

### deleteCacheKey()

> **deleteCacheKey**(`key`): `Promise`\<`void`\>

Defined in: packages/client/src/storage/IStorage.ts:160

Delete a cache key and all associated data.

#### Parameters

##### key

`string`

#### Returns

`Promise`\<`void`\>

---

### deleteCommand()

> **deleteCommand**(`commandId`): `Promise`\<`void`\>

Defined in: packages/client/src/storage/IStorage.ts:216

Delete a command.

#### Parameters

##### commandId

`string`

#### Returns

`Promise`\<`void`\>

---

### deleteReadModel()

> **deleteReadModel**(`collection`, `id`): `Promise`\<`void`\>

Defined in: packages/client/src/storage/IStorage.ts:298

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

Defined in: packages/client/src/storage/IStorage.ts:303

Delete all read model records for a cache key.

#### Parameters

##### cacheKey

`string`

#### Returns

`Promise`\<`void`\>

---

### deleteReadModelsByCollection()

> **deleteReadModelsByCollection**(`collection`): `Promise`\<`void`\>

Defined in: packages/client/src/storage/IStorage.ts:308

Delete all read model records for a collection.

#### Parameters

##### collection

`string`

#### Returns

`Promise`\<`void`\>

---

### deleteSession()

> **deleteSession**(): `Promise`\<`void`\>

Defined in: packages/client/src/storage/IStorage.ts:134

Delete the current session and all associated data.

#### Returns

`Promise`\<`void`\>

---

### getAllCacheKeys()

> **getAllCacheKeys**(): `Promise`\<[`CacheKeyRecord`](CacheKeyRecord.md)[]\>

Defined in: packages/client/src/storage/IStorage.ts:150

Get all cache keys.

#### Returns

`Promise`\<[`CacheKeyRecord`](CacheKeyRecord.md)[]\>

---

### getAnticipatedEventsByCommand()

> **getAnticipatedEventsByCommand**(`commandId`): `Promise`\<[`CachedEventRecord`](CachedEventRecord.md)[]\>

Defined in: packages/client/src/storage/IStorage.ts:242

Get anticipated events for a command.

#### Parameters

##### commandId

`string`

#### Returns

`Promise`\<[`CachedEventRecord`](CachedEventRecord.md)[]\>

---

### getCachedEvent()

> **getCachedEvent**(`id`): `Promise`\<[`CachedEventRecord`](CachedEventRecord.md) \| `undefined`\>

Defined in: packages/client/src/storage/IStorage.ts:227

Get a cached event by ID.

#### Parameters

##### id

`string`

#### Returns

`Promise`\<[`CachedEventRecord`](CachedEventRecord.md) \| `undefined`\>

---

### getCachedEventsByCacheKey()

> **getCachedEventsByCacheKey**(`cacheKey`): `Promise`\<[`CachedEventRecord`](CachedEventRecord.md)[]\>

Defined in: packages/client/src/storage/IStorage.ts:232

Get cached events for a cache key.

#### Parameters

##### cacheKey

`string`

#### Returns

`Promise`\<[`CachedEventRecord`](CachedEventRecord.md)[]\>

---

### getCachedEventsByStream()

> **getCachedEventsByStream**(`streamId`): `Promise`\<[`CachedEventRecord`](CachedEventRecord.md)[]\>

Defined in: packages/client/src/storage/IStorage.ts:237

Get cached events for a stream.

#### Parameters

##### streamId

`string`

#### Returns

`Promise`\<[`CachedEventRecord`](CachedEventRecord.md)[]\>

---

### getCacheKey()

> **getCacheKey**(`key`): `Promise`\<[`CacheKeyRecord`](CacheKeyRecord.md) \| `undefined`\>

Defined in: packages/client/src/storage/IStorage.ts:145

Get a cache key record.

#### Parameters

##### key

`string`

#### Returns

`Promise`\<[`CacheKeyRecord`](CacheKeyRecord.md) \| `undefined`\>

---

### getCommand()

> **getCommand**(`commandId`): `Promise`\<[`CommandRecord`](CommandRecord.md)\<`unknown`, `unknown`\> \| `undefined`\>

Defined in: packages/client/src/storage/IStorage.ts:186

Get a command by ID.

#### Parameters

##### commandId

`string`

#### Returns

`Promise`\<[`CommandRecord`](CommandRecord.md)\<`unknown`, `unknown`\> \| `undefined`\>

---

### getCommands()

> **getCommands**(`filter?`): `Promise`\<[`CommandRecord`](CommandRecord.md)\<`unknown`, `unknown`\>[]\>

Defined in: packages/client/src/storage/IStorage.ts:191

Get commands matching a filter.

#### Parameters

##### filter?

[`CommandFilter`](CommandFilter.md)

#### Returns

`Promise`\<[`CommandRecord`](CommandRecord.md)\<`unknown`, `unknown`\>[]\>

---

### getCommandsBlockedBy()

> **getCommandsBlockedBy**(`commandId`): `Promise`\<[`CommandRecord`](CommandRecord.md)\<`unknown`, `unknown`\>[]\>

Defined in: packages/client/src/storage/IStorage.ts:201

Get commands blocked by a specific command.

#### Parameters

##### commandId

`string`

#### Returns

`Promise`\<[`CommandRecord`](CommandRecord.md)\<`unknown`, `unknown`\>[]\>

---

### getCommandsByStatus()

> **getCommandsByStatus**(`status`): `Promise`\<[`CommandRecord`](CommandRecord.md)\<`unknown`, `unknown`\>[]\>

Defined in: packages/client/src/storage/IStorage.ts:196

Get commands by status.

#### Parameters

##### status

[`CommandStatus`](../type-aliases/CommandStatus.md) | [`CommandStatus`](../type-aliases/CommandStatus.md)[]

#### Returns

`Promise`\<[`CommandRecord`](CommandRecord.md)\<`unknown`, `unknown`\>[]\>

---

### getEvictableCacheKeys()

> **getEvictableCacheKeys**(`limit`): `Promise`\<[`CacheKeyRecord`](CacheKeyRecord.md)[]\>

Defined in: packages/client/src/storage/IStorage.ts:180

Get cache keys eligible for eviction (holdCount = 0, not frozen).

#### Parameters

##### limit

`number`

#### Returns

`Promise`\<[`CacheKeyRecord`](CacheKeyRecord.md)[]\>

---

### getReadModel()

> **getReadModel**(`collection`, `id`): `Promise`\<[`ReadModelRecord`](ReadModelRecord.md) \| `undefined`\>

Defined in: packages/client/src/storage/IStorage.ts:273

Get a read model record.

#### Parameters

##### collection

`string`

##### id

`string`

#### Returns

`Promise`\<[`ReadModelRecord`](ReadModelRecord.md) \| `undefined`\>

---

### getReadModelsByCacheKey()

> **getReadModelsByCacheKey**(`cacheKey`): `Promise`\<[`ReadModelRecord`](ReadModelRecord.md)[]\>

Defined in: packages/client/src/storage/IStorage.ts:283

Get read model records by cache key.

#### Parameters

##### cacheKey

`string`

#### Returns

`Promise`\<[`ReadModelRecord`](ReadModelRecord.md)[]\>

---

### getReadModelsByCollection()

> **getReadModelsByCollection**(`collection`, `options?`): `Promise`\<[`ReadModelRecord`](ReadModelRecord.md)[]\>

Defined in: packages/client/src/storage/IStorage.ts:278

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

> **getSession**(): `Promise`\<[`SessionRecord`](SessionRecord.md) \| `undefined`\>

Defined in: packages/client/src/storage/IStorage.ts:124

Get the current session, if any.

#### Returns

`Promise`\<[`SessionRecord`](SessionRecord.md) \| `undefined`\>

---

### holdCacheKey()

> **holdCacheKey**(`key`): `Promise`\<`void`\>

Defined in: packages/client/src/storage/IStorage.ts:165

Increment hold count for a cache key.

#### Parameters

##### key

`string`

#### Returns

`Promise`\<`void`\>

---

### initialize()

> **initialize**(): `Promise`\<`void`\>

Defined in: packages/client/src/storage/IStorage.ts:108

Initialize the storage backend.
For SQLite, this creates tables and runs migrations.

#### Returns

`Promise`\<`void`\>

---

### releaseCacheKey()

> **releaseCacheKey**(`key`): `Promise`\<`void`\>

Defined in: packages/client/src/storage/IStorage.ts:170

Decrement hold count for a cache key.

#### Parameters

##### key

`string`

#### Returns

`Promise`\<`void`\>

---

### rollbackTransaction()?

> `optional` **rollbackTransaction**(`tx`): `Promise`\<`void`\>

Defined in: packages/client/src/storage/IStorage.ts:325

Rollback a transaction.

#### Parameters

##### tx

`unknown`

#### Returns

`Promise`\<`void`\>

---

### saveCachedEvent()

> **saveCachedEvent**(`event`): `Promise`\<`void`\>

Defined in: packages/client/src/storage/IStorage.ts:247

Save a cached event.

#### Parameters

##### event

[`CachedEventRecord`](CachedEventRecord.md)

#### Returns

`Promise`\<`void`\>

---

### saveCachedEvents()

> **saveCachedEvents**(`events`): `Promise`\<`void`\>

Defined in: packages/client/src/storage/IStorage.ts:252

Save multiple cached events in a batch.

#### Parameters

##### events

[`CachedEventRecord`](CachedEventRecord.md)[]

#### Returns

`Promise`\<`void`\>

---

### saveCacheKey()

> **saveCacheKey**(`record`): `Promise`\<`void`\>

Defined in: packages/client/src/storage/IStorage.ts:155

Save or update a cache key.

#### Parameters

##### record

[`CacheKeyRecord`](CacheKeyRecord.md)

#### Returns

`Promise`\<`void`\>

---

### saveCommand()

> **saveCommand**(`command`): `Promise`\<`void`\>

Defined in: packages/client/src/storage/IStorage.ts:206

Save a new command.

#### Parameters

##### command

[`CommandRecord`](CommandRecord.md)

#### Returns

`Promise`\<`void`\>

---

### saveReadModel()

> **saveReadModel**(`record`): `Promise`\<`void`\>

Defined in: packages/client/src/storage/IStorage.ts:288

Save a read model record.

#### Parameters

##### record

[`ReadModelRecord`](ReadModelRecord.md)

#### Returns

`Promise`\<`void`\>

---

### saveReadModels()

> **saveReadModels**(`records`): `Promise`\<`void`\>

Defined in: packages/client/src/storage/IStorage.ts:293

Save multiple read model records in a batch.

#### Parameters

##### records

[`ReadModelRecord`](ReadModelRecord.md)[]

#### Returns

`Promise`\<`void`\>

---

### saveSession()

> **saveSession**(`session`): `Promise`\<`void`\>

Defined in: packages/client/src/storage/IStorage.ts:129

Save or update the session.

#### Parameters

##### session

[`SessionRecord`](SessionRecord.md)

#### Returns

`Promise`\<`void`\>

---

### touchCacheKey()

> **touchCacheKey**(`key`): `Promise`\<`void`\>

Defined in: packages/client/src/storage/IStorage.ts:175

Touch a cache key (update lastAccessedAt).

#### Parameters

##### key

`string`

#### Returns

`Promise`\<`void`\>

---

### touchSession()

> **touchSession**(): `Promise`\<`void`\>

Defined in: packages/client/src/storage/IStorage.ts:139

Update the last seen timestamp.

#### Returns

`Promise`\<`void`\>

---

### updateCommand()

> **updateCommand**(`commandId`, `updates`): `Promise`\<`void`\>

Defined in: packages/client/src/storage/IStorage.ts:211

Update an existing command.

#### Parameters

##### commandId

`string`

##### updates

`Partial`\<[`CommandRecord`](CommandRecord.md)\>

#### Returns

`Promise`\<`void`\>
