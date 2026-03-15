[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / InMemoryStorage

# Class: InMemoryStorage

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

Clear all data from storage.

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`clear`](../interfaces/IStorage.md#clear)

---

### close()

> **close**(): `Promise`\<`void`\>

Close the storage backend and release resources.

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`close`](../interfaces/IStorage.md#close)

---

### deleteAllCommandIdMappings()

> **deleteAllCommandIdMappings**(): `Promise`\<`void`\>

Delete all command ID mappings (e.g., on session clear).

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`deleteAllCommandIdMappings`](../interfaces/IStorage.md#deleteallcommandidmappings)

---

### deleteAllCommands()

> **deleteAllCommands**(): `Promise`\<`void`\>

Delete all commands (e.g., on session clear).

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`deleteAllCommands`](../interfaces/IStorage.md#deleteallcommands)

---

### deleteAnticipatedEventsByCommand()

> **deleteAnticipatedEventsByCommand**(`commandId`): `Promise`\<`void`\>

Delete all anticipated events for a command.

#### Parameters

##### commandId

`string`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`deleteAnticipatedEventsByCommand`](../interfaces/IStorage.md#deleteanticipatedeventsbycommand)

---

### deleteCachedEvent()

> **deleteCachedEvent**(`id`): `Promise`\<`void`\>

Delete a cached event.

#### Parameters

##### id

`string`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`deleteCachedEvent`](../interfaces/IStorage.md#deletecachedevent)

---

### deleteCachedEventsByCacheKey()

> **deleteCachedEventsByCacheKey**(`cacheKey`): `Promise`\<`void`\>

Delete all cached events for a cache key.

#### Parameters

##### cacheKey

`string`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`deleteCachedEventsByCacheKey`](../interfaces/IStorage.md#deletecachedeventsbycachekey)

---

### deleteCacheKey()

> **deleteCacheKey**(`key`): `Promise`\<`void`\>

Delete a cache key and all associated data.

#### Parameters

##### key

`string`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`deleteCacheKey`](../interfaces/IStorage.md#deletecachekey)

---

### deleteCommand()

> **deleteCommand**(`commandId`): `Promise`\<`void`\>

Delete a command.

#### Parameters

##### commandId

`string`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`deleteCommand`](../interfaces/IStorage.md#deletecommand)

---

### deleteCommandIdMappingsOlderThan()

> **deleteCommandIdMappingsOlderThan**(`timestamp`): `Promise`\<`void`\>

Delete command ID mappings older than a timestamp.

#### Parameters

##### timestamp

`number`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`deleteCommandIdMappingsOlderThan`](../interfaces/IStorage.md#deletecommandidmappingsolderthan)

---

### deleteReadModel()

> **deleteReadModel**(`collection`, `id`): `Promise`\<`void`\>

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

---

### deleteReadModelsByCacheKey()

> **deleteReadModelsByCacheKey**(`cacheKey`): `Promise`\<`void`\>

Delete all read model records for a cache key.

#### Parameters

##### cacheKey

`string`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`deleteReadModelsByCacheKey`](../interfaces/IStorage.md#deletereadmodelsbycachekey)

---

### deleteReadModelsByCollection()

> **deleteReadModelsByCollection**(`collection`): `Promise`\<`void`\>

Delete all read model records for a collection.

#### Parameters

##### collection

`string`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`deleteReadModelsByCollection`](../interfaces/IStorage.md#deletereadmodelsbycollection)

---

### deleteSession()

> **deleteSession**(): `Promise`\<`void`\>

Delete the current session and all associated data.

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`deleteSession`](../interfaces/IStorage.md#deletesession)

---

### getAllCacheKeys()

> **getAllCacheKeys**(): `Promise`\<[`CacheKeyRecord`](../interfaces/CacheKeyRecord.md)[]\>

Get all cache keys.

#### Returns

`Promise`\<[`CacheKeyRecord`](../interfaces/CacheKeyRecord.md)[]\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`getAllCacheKeys`](../interfaces/IStorage.md#getallcachekeys)

---

### getAnticipatedEventsByCommand()

> **getAnticipatedEventsByCommand**(`commandId`): `Promise`\<[`CachedEventRecord`](../interfaces/CachedEventRecord.md)[]\>

Get anticipated events for a command.

#### Parameters

##### commandId

`string`

#### Returns

`Promise`\<[`CachedEventRecord`](../interfaces/CachedEventRecord.md)[]\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`getAnticipatedEventsByCommand`](../interfaces/IStorage.md#getanticipatedeventsbycommand)

---

### getCachedEvent()

> **getCachedEvent**(`id`): `Promise`\<[`CachedEventRecord`](../interfaces/CachedEventRecord.md) \| `undefined`\>

Get a cached event by ID.

#### Parameters

##### id

`string`

#### Returns

`Promise`\<[`CachedEventRecord`](../interfaces/CachedEventRecord.md) \| `undefined`\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`getCachedEvent`](../interfaces/IStorage.md#getcachedevent)

---

### getCachedEventsByCacheKey()

> **getCachedEventsByCacheKey**(`cacheKey`): `Promise`\<[`CachedEventRecord`](../interfaces/CachedEventRecord.md)[]\>

Get cached events for a cache key.

#### Parameters

##### cacheKey

`string`

#### Returns

`Promise`\<[`CachedEventRecord`](../interfaces/CachedEventRecord.md)[]\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`getCachedEventsByCacheKey`](../interfaces/IStorage.md#getcachedeventsbycachekey)

---

### getCachedEventsByStream()

> **getCachedEventsByStream**(`streamId`): `Promise`\<[`CachedEventRecord`](../interfaces/CachedEventRecord.md)[]\>

Get cached events for a stream.

#### Parameters

##### streamId

`string`

#### Returns

`Promise`\<[`CachedEventRecord`](../interfaces/CachedEventRecord.md)[]\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`getCachedEventsByStream`](../interfaces/IStorage.md#getcachedeventsbystream)

---

### getCacheKey()

> **getCacheKey**(`key`): `Promise`\<[`CacheKeyRecord`](../interfaces/CacheKeyRecord.md) \| `undefined`\>

Get a cache key record.

#### Parameters

##### key

`string`

#### Returns

`Promise`\<[`CacheKeyRecord`](../interfaces/CacheKeyRecord.md) \| `undefined`\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`getCacheKey`](../interfaces/IStorage.md#getcachekey)

---

### getCommand()

> **getCommand**(`commandId`): `Promise`\<[`CommandRecord`](../interfaces/CommandRecord.md)\<`unknown`, `unknown`\> \| `undefined`\>

Get a command by ID.

#### Parameters

##### commandId

`string`

#### Returns

`Promise`\<[`CommandRecord`](../interfaces/CommandRecord.md)\<`unknown`, `unknown`\> \| `undefined`\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`getCommand`](../interfaces/IStorage.md#getcommand)

---

### getCommandIdMapping()

> **getCommandIdMapping**(`clientId`): `Promise`\<`CommandIdMappingRecord` \| `undefined`\>

Get a command ID mapping by client ID.

#### Parameters

##### clientId

`string`

#### Returns

`Promise`\<`CommandIdMappingRecord` \| `undefined`\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`getCommandIdMapping`](../interfaces/IStorage.md#getcommandidmapping)

---

### getCommandIdMappingByServerId()

> **getCommandIdMappingByServerId**(`serverId`): `Promise`\<`CommandIdMappingRecord` \| `undefined`\>

Get a command ID mapping by server ID.

#### Parameters

##### serverId

`string`

#### Returns

`Promise`\<`CommandIdMappingRecord` \| `undefined`\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`getCommandIdMappingByServerId`](../interfaces/IStorage.md#getcommandidmappingbyserverid)

---

### getCommands()

> **getCommands**(`filter?`): `Promise`\<[`CommandRecord`](../interfaces/CommandRecord.md)\<`unknown`, `unknown`\>[]\>

Get commands matching a filter.

#### Parameters

##### filter?

[`CommandFilter`](../interfaces/CommandFilter.md)

#### Returns

`Promise`\<[`CommandRecord`](../interfaces/CommandRecord.md)\<`unknown`, `unknown`\>[]\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`getCommands`](../interfaces/IStorage.md#getcommands)

---

### getCommandsBlockedBy()

> **getCommandsBlockedBy**(`commandId`): `Promise`\<[`CommandRecord`](../interfaces/CommandRecord.md)\<`unknown`, `unknown`\>[]\>

Get commands blocked by a specific command.

#### Parameters

##### commandId

`string`

#### Returns

`Promise`\<[`CommandRecord`](../interfaces/CommandRecord.md)\<`unknown`, `unknown`\>[]\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`getCommandsBlockedBy`](../interfaces/IStorage.md#getcommandsblockedby)

---

### getCommandsByStatus()

> **getCommandsByStatus**(`status`): `Promise`\<[`CommandRecord`](../interfaces/CommandRecord.md)\<`unknown`, `unknown`\>[]\>

Get commands by status.

#### Parameters

##### status

[`CommandStatus`](../type-aliases/CommandStatus.md) | [`CommandStatus`](../type-aliases/CommandStatus.md)[]

#### Returns

`Promise`\<[`CommandRecord`](../interfaces/CommandRecord.md)\<`unknown`, `unknown`\>[]\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`getCommandsByStatus`](../interfaces/IStorage.md#getcommandsbystatus)

---

### getEvictableCacheKeys()

> **getEvictableCacheKeys**(`limit`): `Promise`\<[`CacheKeyRecord`](../interfaces/CacheKeyRecord.md)[]\>

Get cache keys eligible for eviction (holdCount = 0, not frozen).

#### Parameters

##### limit

`number`

#### Returns

`Promise`\<[`CacheKeyRecord`](../interfaces/CacheKeyRecord.md)[]\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`getEvictableCacheKeys`](../interfaces/IStorage.md#getevictablecachekeys)

---

### getReadModel()

> **getReadModel**(`collection`, `id`): `Promise`\<[`ReadModelRecord`](../interfaces/ReadModelRecord.md) \| `undefined`\>

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

---

### getReadModelCount()

> **getReadModelCount**(): `Promise`\<`number`\>

Get the total count of read model records.

#### Returns

`Promise`\<`number`\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`getReadModelCount`](../interfaces/IStorage.md#getreadmodelcount)

---

### getReadModelsByCacheKey()

> **getReadModelsByCacheKey**(`cacheKey`): `Promise`\<[`ReadModelRecord`](../interfaces/ReadModelRecord.md)[]\>

Get read model records by cache key.

#### Parameters

##### cacheKey

`string`

#### Returns

`Promise`\<[`ReadModelRecord`](../interfaces/ReadModelRecord.md)[]\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`getReadModelsByCacheKey`](../interfaces/IStorage.md#getreadmodelsbycachekey)

---

### getReadModelsByCollection()

> **getReadModelsByCollection**(`collection`, `options?`): `Promise`\<[`ReadModelRecord`](../interfaces/ReadModelRecord.md)[]\>

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

---

### getSession()

> **getSession**(): `Promise`\<[`SessionRecord`](../interfaces/SessionRecord.md) \| `undefined`\>

Get the current session, if any.

#### Returns

`Promise`\<[`SessionRecord`](../interfaces/SessionRecord.md) \| `undefined`\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`getSession`](../interfaces/IStorage.md#getsession)

---

### holdCacheKey()

> **holdCacheKey**(`key`): `Promise`\<`void`\>

Increment hold count for a cache key.

#### Parameters

##### key

`string`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`holdCacheKey`](../interfaces/IStorage.md#holdcachekey)

---

### initialize()

> **initialize**(): `Promise`\<`void`\>

Initialize the storage backend.
For SQLite, this creates tables and runs migrations.

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`initialize`](../interfaces/IStorage.md#initialize)

---

### releaseCacheKey()

> **releaseCacheKey**(`key`): `Promise`\<`void`\>

Decrement hold count for a cache key.

#### Parameters

##### key

`string`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`releaseCacheKey`](../interfaces/IStorage.md#releasecachekey)

---

### saveCachedEvent()

> **saveCachedEvent**(`event`): `Promise`\<`void`\>

Save a cached event.

#### Parameters

##### event

[`CachedEventRecord`](../interfaces/CachedEventRecord.md)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`saveCachedEvent`](../interfaces/IStorage.md#savecachedevent)

---

### saveCachedEvents()

> **saveCachedEvents**(`events`): `Promise`\<`void`\>

Save multiple cached events in a batch.

#### Parameters

##### events

[`CachedEventRecord`](../interfaces/CachedEventRecord.md)[]

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`saveCachedEvents`](../interfaces/IStorage.md#savecachedevents)

---

### saveCacheKey()

> **saveCacheKey**(`record`): `Promise`\<`void`\>

Save or update a cache key.

#### Parameters

##### record

[`CacheKeyRecord`](../interfaces/CacheKeyRecord.md)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`saveCacheKey`](../interfaces/IStorage.md#savecachekey)

---

### saveCommand()

> **saveCommand**(`command`): `Promise`\<`void`\>

Save a new command.

#### Parameters

##### command

[`CommandRecord`](../interfaces/CommandRecord.md)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`saveCommand`](../interfaces/IStorage.md#savecommand)

---

### saveCommandIdMapping()

> **saveCommandIdMapping**(`record`): `Promise`\<`void`\>

Save a command ID mapping.

#### Parameters

##### record

`CommandIdMappingRecord`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`saveCommandIdMapping`](../interfaces/IStorage.md#savecommandidmapping)

---

### saveReadModel()

> **saveReadModel**(`record`): `Promise`\<`void`\>

Save a read model record.

#### Parameters

##### record

[`ReadModelRecord`](../interfaces/ReadModelRecord.md)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`saveReadModel`](../interfaces/IStorage.md#savereadmodel)

---

### saveReadModels()

> **saveReadModels**(`records`): `Promise`\<`void`\>

Save multiple read model records in a batch.

#### Parameters

##### records

[`ReadModelRecord`](../interfaces/ReadModelRecord.md)[]

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`saveReadModels`](../interfaces/IStorage.md#savereadmodels)

---

### saveSession()

> **saveSession**(`session`): `Promise`\<`void`\>

Save or update the session.

#### Parameters

##### session

[`SessionRecord`](../interfaces/SessionRecord.md)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`saveSession`](../interfaces/IStorage.md#savesession)

---

### touchCacheKey()

> **touchCacheKey**(`key`): `Promise`\<`void`\>

Touch a cache key (update lastAccessedAt).

#### Parameters

##### key

`string`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`touchCacheKey`](../interfaces/IStorage.md#touchcachekey)

---

### touchSession()

> **touchSession**(): `Promise`\<`void`\>

Update the last seen timestamp.

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`touchSession`](../interfaces/IStorage.md#touchsession)

---

### updateCommand()

> **updateCommand**(`commandId`, `updates`): `Promise`\<`void`\>

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
