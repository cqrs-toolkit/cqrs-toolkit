[**@cqrs-toolkit/client**](../README.md)

***

[@cqrs-toolkit/client](../globals.md) / InMemoryStorage

# Class: InMemoryStorage

Defined in: packages/client/src/storage/InMemoryStorage.ts:20

In-memory storage implementation.
Thread-safe within a single JavaScript context.

## Implements

- [`IStorage`](../interfaces/IStorage.md)

## Constructors

### Constructor

> **new InMemoryStorage**(): `InMemoryStorage`

#### Returns

`InMemoryStorage`

## Methods

### clear()

> **clear**(): `Promise`\<`void`\>

Defined in: packages/client/src/storage/InMemoryStorage.ts:39

Clear all data from storage.

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`clear`](../interfaces/IStorage.md#clear)

***

### close()

> **close**(): `Promise`\<`void`\>

Defined in: packages/client/src/storage/InMemoryStorage.ts:35

Close the storage backend and release resources.

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`close`](../interfaces/IStorage.md#close)

***

### deleteAllCommands()

> **deleteAllCommands**(): `Promise`\<`void`\>

Defined in: packages/client/src/storage/InMemoryStorage.ts:196

Delete all commands (e.g., on session clear).

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`deleteAllCommands`](../interfaces/IStorage.md#deleteallcommands)

***

### deleteAnticipatedEventsByCommand()

> **deleteAnticipatedEventsByCommand**(`commandId`): `Promise`\<`void`\>

Defined in: packages/client/src/storage/InMemoryStorage.ts:248

Delete all anticipated events for a command.

#### Parameters

##### commandId

`string`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`deleteAnticipatedEventsByCommand`](../interfaces/IStorage.md#deleteanticipatedeventsbycommand)

***

### deleteCachedEvent()

> **deleteCachedEvent**(`id`): `Promise`\<`void`\>

Defined in: packages/client/src/storage/InMemoryStorage.ts:244

Delete a cached event.

#### Parameters

##### id

`string`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`deleteCachedEvent`](../interfaces/IStorage.md#deletecachedevent)

***

### deleteCachedEventsByCacheKey()

> **deleteCachedEventsByCacheKey**(`cacheKey`): `Promise`\<`void`\>

Defined in: packages/client/src/storage/InMemoryStorage.ts:256

Delete all cached events for a cache key.

#### Parameters

##### cacheKey

`string`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`deleteCachedEventsByCacheKey`](../interfaces/IStorage.md#deletecachedeventsbycachekey)

***

### deleteCacheKey()

> **deleteCacheKey**(`key`): `Promise`\<`void`\>

Defined in: packages/client/src/storage/InMemoryStorage.ts:86

Delete a cache key and all associated data.

#### Parameters

##### key

`string`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`deleteCacheKey`](../interfaces/IStorage.md#deletecachekey)

***

### deleteCommand()

> **deleteCommand**(`commandId`): `Promise`\<`void`\>

Defined in: packages/client/src/storage/InMemoryStorage.ts:190

Delete a command.

#### Parameters

##### commandId

`string`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`deleteCommand`](../interfaces/IStorage.md#deletecommand)

***

### deleteReadModel()

> **deleteReadModel**(`collection`, `id`): `Promise`\<`void`\>

Defined in: packages/client/src/storage/InMemoryStorage.ts:321

Delete a read model record.

#### Parameters

##### collection

`string`

##### id

`string`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`deleteReadModel`](../interfaces/IStorage.md#deletereadmodel)

***

### deleteReadModelsByCacheKey()

> **deleteReadModelsByCacheKey**(`cacheKey`): `Promise`\<`void`\>

Defined in: packages/client/src/storage/InMemoryStorage.ts:325

Delete all read model records for a cache key.

#### Parameters

##### cacheKey

`string`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`deleteReadModelsByCacheKey`](../interfaces/IStorage.md#deletereadmodelsbycachekey)

***

### deleteReadModelsByCollection()

> **deleteReadModelsByCollection**(`collection`): `Promise`\<`void`\>

Defined in: packages/client/src/storage/InMemoryStorage.ts:333

Delete all read model records for a collection.

#### Parameters

##### collection

`string`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`deleteReadModelsByCollection`](../interfaces/IStorage.md#deletereadmodelsbycollection)

***

### deleteSession()

> **deleteSession**(): `Promise`\<`void`\>

Defined in: packages/client/src/storage/InMemoryStorage.ts:57

Delete the current session and all associated data.

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`deleteSession`](../interfaces/IStorage.md#deletesession)

***

### getAllCacheKeys()

> **getAllCacheKeys**(): `Promise`\<[`CacheKeyRecord`](../interfaces/CacheKeyRecord.md)[]\>

Defined in: packages/client/src/storage/InMemoryStorage.ts:78

Get all cache keys.

#### Returns

`Promise`\<[`CacheKeyRecord`](../interfaces/CacheKeyRecord.md)[]\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`getAllCacheKeys`](../interfaces/IStorage.md#getallcachekeys)

***

### getAnticipatedEventsByCommand()

> **getAnticipatedEventsByCommand**(`commandId`): `Promise`\<[`CachedEventRecord`](../interfaces/CachedEventRecord.md)[]\>

Defined in: packages/client/src/storage/InMemoryStorage.ts:228

Get anticipated events for a command.

#### Parameters

##### commandId

`string`

#### Returns

`Promise`\<[`CachedEventRecord`](../interfaces/CachedEventRecord.md)[]\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`getAnticipatedEventsByCommand`](../interfaces/IStorage.md#getanticipatedeventsbycommand)

***

### getCachedEvent()

> **getCachedEvent**(`id`): `Promise`\<[`CachedEventRecord`](../interfaces/CachedEventRecord.md) \| `undefined`\>

Defined in: packages/client/src/storage/InMemoryStorage.ts:208

Get a cached event by ID.

#### Parameters

##### id

`string`

#### Returns

`Promise`\<[`CachedEventRecord`](../interfaces/CachedEventRecord.md) \| `undefined`\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`getCachedEvent`](../interfaces/IStorage.md#getcachedevent)

***

### getCachedEventsByCacheKey()

> **getCachedEventsByCacheKey**(`cacheKey`): `Promise`\<[`CachedEventRecord`](../interfaces/CachedEventRecord.md)[]\>

Defined in: packages/client/src/storage/InMemoryStorage.ts:212

Get cached events for a cache key.

#### Parameters

##### cacheKey

`string`

#### Returns

`Promise`\<[`CachedEventRecord`](../interfaces/CachedEventRecord.md)[]\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`getCachedEventsByCacheKey`](../interfaces/IStorage.md#getcachedeventsbycachekey)

***

### getCachedEventsByStream()

> **getCachedEventsByStream**(`streamId`): `Promise`\<[`CachedEventRecord`](../interfaces/CachedEventRecord.md)[]\>

Defined in: packages/client/src/storage/InMemoryStorage.ts:216

Get cached events for a stream.

#### Parameters

##### streamId

`string`

#### Returns

`Promise`\<[`CachedEventRecord`](../interfaces/CachedEventRecord.md)[]\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`getCachedEventsByStream`](../interfaces/IStorage.md#getcachedeventsbystream)

***

### getCacheKey()

> **getCacheKey**(`key`): `Promise`\<[`CacheKeyRecord`](../interfaces/CacheKeyRecord.md) \| `undefined`\>

Defined in: packages/client/src/storage/InMemoryStorage.ts:74

Get a cache key record.

#### Parameters

##### key

`string`

#### Returns

`Promise`\<[`CacheKeyRecord`](../interfaces/CacheKeyRecord.md) \| `undefined`\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`getCacheKey`](../interfaces/IStorage.md#getcachekey)

***

### getCommand()

> **getCommand**(`commandId`): `Promise`\<[`CommandRecord`](../interfaces/CommandRecord.md)\<`unknown`, `unknown`\> \| `undefined`\>

Defined in: packages/client/src/storage/InMemoryStorage.ts:131

Get a command by ID.

#### Parameters

##### commandId

`string`

#### Returns

`Promise`\<[`CommandRecord`](../interfaces/CommandRecord.md)\<`unknown`, `unknown`\> \| `undefined`\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`getCommand`](../interfaces/IStorage.md#getcommand)

***

### getCommands()

> **getCommands**(`filter?`): `Promise`\<[`CommandRecord`](../interfaces/CommandRecord.md)\<`unknown`, `unknown`\>[]\>

Defined in: packages/client/src/storage/InMemoryStorage.ts:135

Get commands matching a filter.

#### Parameters

##### filter?

[`CommandFilter`](../interfaces/CommandFilter.md)

#### Returns

`Promise`\<[`CommandRecord`](../interfaces/CommandRecord.md)\<`unknown`, `unknown`\>[]\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`getCommands`](../interfaces/IStorage.md#getcommands)

***

### getCommandsBlockedBy()

> **getCommandsBlockedBy**(`commandId`): `Promise`\<[`CommandRecord`](../interfaces/CommandRecord.md)\<`unknown`, `unknown`\>[]\>

Defined in: packages/client/src/storage/InMemoryStorage.ts:175

Get commands blocked by a specific command.

#### Parameters

##### commandId

`string`

#### Returns

`Promise`\<[`CommandRecord`](../interfaces/CommandRecord.md)\<`unknown`, `unknown`\>[]\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`getCommandsBlockedBy`](../interfaces/IStorage.md#getcommandsblockedby)

***

### getCommandsByStatus()

> **getCommandsByStatus**(`status`): `Promise`\<[`CommandRecord`](../interfaces/CommandRecord.md)\<`unknown`, `unknown`\>[]\>

Defined in: packages/client/src/storage/InMemoryStorage.ts:171

Get commands by status.

#### Parameters

##### status

[`CommandStatus`](../type-aliases/CommandStatus.md) | [`CommandStatus`](../type-aliases/CommandStatus.md)[]

#### Returns

`Promise`\<[`CommandRecord`](../interfaces/CommandRecord.md)\<`unknown`, `unknown`\>[]\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`getCommandsByStatus`](../interfaces/IStorage.md#getcommandsbystatus)

***

### getEvictableCacheKeys()

> **getEvictableCacheKeys**(`limit`): `Promise`\<[`CacheKeyRecord`](../interfaces/CacheKeyRecord.md)[]\>

Defined in: packages/client/src/storage/InMemoryStorage.ts:115

Get cache keys eligible for eviction (holdCount = 0, not frozen).

#### Parameters

##### limit

`number`

#### Returns

`Promise`\<[`CacheKeyRecord`](../interfaces/CacheKeyRecord.md)[]\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`getEvictableCacheKeys`](../interfaces/IStorage.md#getevictablecachekeys)

***

### getReadModel()

> **getReadModel**(`collection`, `id`): `Promise`\<[`ReadModelRecord`](../interfaces/ReadModelRecord.md) \| `undefined`\>

Defined in: packages/client/src/storage/InMemoryStorage.ts:270

Get a read model record.

#### Parameters

##### collection

`string`

##### id

`string`

#### Returns

`Promise`\<[`ReadModelRecord`](../interfaces/ReadModelRecord.md) \| `undefined`\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`getReadModel`](../interfaces/IStorage.md#getreadmodel)

***

### getReadModelsByCacheKey()

> **getReadModelsByCacheKey**(`cacheKey`): `Promise`\<[`ReadModelRecord`](../interfaces/ReadModelRecord.md)[]\>

Defined in: packages/client/src/storage/InMemoryStorage.ts:307

Get read model records by cache key.

#### Parameters

##### cacheKey

`string`

#### Returns

`Promise`\<[`ReadModelRecord`](../interfaces/ReadModelRecord.md)[]\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`getReadModelsByCacheKey`](../interfaces/IStorage.md#getreadmodelsbycachekey)

***

### getReadModelsByCollection()

> **getReadModelsByCollection**(`collection`, `options?`): `Promise`\<[`ReadModelRecord`](../interfaces/ReadModelRecord.md)[]\>

Defined in: packages/client/src/storage/InMemoryStorage.ts:274

Get all read model records for a collection.

#### Parameters

##### collection

`string`

##### options?

[`QueryOptions`](../interfaces/QueryOptions.md)

#### Returns

`Promise`\<[`ReadModelRecord`](../interfaces/ReadModelRecord.md)[]\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`getReadModelsByCollection`](../interfaces/IStorage.md#getreadmodelsbycollection)

***

### getSession()

> **getSession**(): `Promise`\<[`SessionRecord`](../interfaces/SessionRecord.md) \| `undefined`\>

Defined in: packages/client/src/storage/InMemoryStorage.ts:49

Get the current session, if any.

#### Returns

`Promise`\<[`SessionRecord`](../interfaces/SessionRecord.md) \| `undefined`\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`getSession`](../interfaces/IStorage.md#getsession)

***

### holdCacheKey()

> **holdCacheKey**(`key`): `Promise`\<`void`\>

Defined in: packages/client/src/storage/InMemoryStorage.ts:94

Increment hold count for a cache key.

#### Parameters

##### key

`string`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`holdCacheKey`](../interfaces/IStorage.md#holdcachekey)

***

### initialize()

> **initialize**(): `Promise`\<`void`\>

Defined in: packages/client/src/storage/InMemoryStorage.ts:31

Initialize the storage backend.
For SQLite, this creates tables and runs migrations.

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`initialize`](../interfaces/IStorage.md#initialize)

***

### releaseCacheKey()

> **releaseCacheKey**(`key`): `Promise`\<`void`\>

Defined in: packages/client/src/storage/InMemoryStorage.ts:101

Decrement hold count for a cache key.

#### Parameters

##### key

`string`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`releaseCacheKey`](../interfaces/IStorage.md#releasecachekey)

***

### saveCachedEvent()

> **saveCachedEvent**(`event`): `Promise`\<`void`\>

Defined in: packages/client/src/storage/InMemoryStorage.ts:234

Save a cached event.

#### Parameters

##### event

[`CachedEventRecord`](../interfaces/CachedEventRecord.md)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`saveCachedEvent`](../interfaces/IStorage.md#savecachedevent)

***

### saveCachedEvents()

> **saveCachedEvents**(`events`): `Promise`\<`void`\>

Defined in: packages/client/src/storage/InMemoryStorage.ts:238

Save multiple cached events in a batch.

#### Parameters

##### events

[`CachedEventRecord`](../interfaces/CachedEventRecord.md)[]

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`saveCachedEvents`](../interfaces/IStorage.md#savecachedevents)

***

### saveCacheKey()

> **saveCacheKey**(`record`): `Promise`\<`void`\>

Defined in: packages/client/src/storage/InMemoryStorage.ts:82

Save or update a cache key.

#### Parameters

##### record

[`CacheKeyRecord`](../interfaces/CacheKeyRecord.md)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`saveCacheKey`](../interfaces/IStorage.md#savecachekey)

***

### saveCommand()

> **saveCommand**(`command`): `Promise`\<`void`\>

Defined in: packages/client/src/storage/InMemoryStorage.ts:179

Save a new command.

#### Parameters

##### command

[`CommandRecord`](../interfaces/CommandRecord.md)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`saveCommand`](../interfaces/IStorage.md#savecommand)

***

### saveReadModel()

> **saveReadModel**(`record`): `Promise`\<`void`\>

Defined in: packages/client/src/storage/InMemoryStorage.ts:311

Save a read model record.

#### Parameters

##### record

[`ReadModelRecord`](../interfaces/ReadModelRecord.md)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`saveReadModel`](../interfaces/IStorage.md#savereadmodel)

***

### saveReadModels()

> **saveReadModels**(`records`): `Promise`\<`void`\>

Defined in: packages/client/src/storage/InMemoryStorage.ts:315

Save multiple read model records in a batch.

#### Parameters

##### records

[`ReadModelRecord`](../interfaces/ReadModelRecord.md)[]

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`saveReadModels`](../interfaces/IStorage.md#savereadmodels)

***

### saveSession()

> **saveSession**(`session`): `Promise`\<`void`\>

Defined in: packages/client/src/storage/InMemoryStorage.ts:53

Save or update the session.

#### Parameters

##### session

[`SessionRecord`](../interfaces/SessionRecord.md)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`saveSession`](../interfaces/IStorage.md#savesession)

***

### touchCacheKey()

> **touchCacheKey**(`key`): `Promise`\<`void`\>

Defined in: packages/client/src/storage/InMemoryStorage.ts:108

Touch a cache key (update lastAccessedAt).

#### Parameters

##### key

`string`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`touchCacheKey`](../interfaces/IStorage.md#touchcachekey)

***

### touchSession()

> **touchSession**(): `Promise`\<`void`\>

Defined in: packages/client/src/storage/InMemoryStorage.ts:66

Update the last seen timestamp.

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`touchSession`](../interfaces/IStorage.md#touchsession)

***

### updateCommand()

> **updateCommand**(`commandId`, `updates`): `Promise`\<`void`\>

Defined in: packages/client/src/storage/InMemoryStorage.ts:183

Update an existing command.

#### Parameters

##### commandId

`string`

##### updates

`Partial`\<[`CommandRecord`](../interfaces/CommandRecord.md)\>

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`updateCommand`](../interfaces/IStorage.md#updatecommand)
