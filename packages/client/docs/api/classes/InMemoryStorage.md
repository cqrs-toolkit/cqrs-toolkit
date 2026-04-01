[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / InMemoryStorage

# Class: InMemoryStorage\<TLink, TCommand\>

In-memory storage implementation.
Thread-safe within a single JavaScript context.

## Type Parameters

### TLink

`TLink` _extends_ `Link`

### TCommand

`TCommand` _extends_ [`EnqueueCommand`](../interfaces/EnqueueCommand.md)

## Implements

- [`IStorage`](../interfaces/IStorage.md)\<`TLink`, `TCommand`\>

## Constructors

### Constructor

> **new InMemoryStorage**\<`TLink`, `TCommand`\>(): `InMemoryStorage`\<`TLink`, `TCommand`\>

#### Returns

`InMemoryStorage`\<`TLink`, `TCommand`\>

## Methods

### addCacheKeysToEvent()

> **addCacheKeysToEvent**(`eventId`, `cacheKeys`): `Promise`\<`void`\>

Add cache key associations to an existing event.
Used when a WS event is relevant to additional active cache keys.

#### Parameters

##### eventId

`string`

##### cacheKeys

`string`[]

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`addCacheKeysToEvent`](../interfaces/IStorage.md#addcachekeystoevent)

---

### addCacheKeysToReadModel()

> **addCacheKeysToReadModel**(`collection`, `id`, `cacheKeys`): `Promise`\<`void`\>

Add cache key associations to an existing read model.
Used when a read model is relevant to additional active cache keys.

#### Parameters

##### collection

`string`

##### id

`string`

##### cacheKeys

`string`[]

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`addCacheKeysToReadModel`](../interfaces/IStorage.md#addcachekeystoreadmodel)

---

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

### countReadModels()

> **countReadModels**(`collection`, `cacheKey?`): `Promise`\<`number`\>

Count read model records in a collection, optionally filtered by cache key.

#### Parameters

##### collection

`string`

##### cacheKey?

`string`

#### Returns

`Promise`\<`number`\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`countReadModels`](../interfaces/IStorage.md#countreadmodels)

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

### deleteProcessedCachedEvents()

> **deleteProcessedCachedEvents**(`olderThan`): `Promise`\<`number`\>

Delete cached events that were processed before the given timestamp.
Cleans up both the events table and the junction table.
Returns the number of events deleted.

#### Parameters

##### olderThan

`number`

#### Returns

`Promise`\<`number`\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`deleteProcessedCachedEvents`](../interfaces/IStorage.md#deleteprocessedcachedevents)

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

### filterExistingCacheKeys()

> **filterExistingCacheKeys**(`keys`): `Promise`\<`string`[]\>

Filter an array of cache key strings to only those that exist in storage.

#### Parameters

##### keys

`string`[]

#### Returns

`Promise`\<`string`[]\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`filterExistingCacheKeys`](../interfaces/IStorage.md#filterexistingcachekeys)

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

### getChildCacheKeys()

> **getChildCacheKeys**(`parentKey`): `Promise`\<[`CacheKeyRecord`](../interfaces/CacheKeyRecord.md)[]\>

Get child cache keys whose parentKey matches the given key.

#### Parameters

##### parentKey

`string`

#### Returns

`Promise`\<[`CacheKeyRecord`](../interfaces/CacheKeyRecord.md)[]\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`getChildCacheKeys`](../interfaces/IStorage.md#getchildcachekeys)

---

### getCommand()

> **getCommand**(`commandId`): `Promise`\<[`CommandRecord`](../interfaces/CommandRecord.md)\<`TLink`, `TCommand`, `unknown`\> \| `undefined`\>

Get a command by ID.

#### Parameters

##### commandId

`string`

#### Returns

`Promise`\<[`CommandRecord`](../interfaces/CommandRecord.md)\<`TLink`, `TCommand`, `unknown`\> \| `undefined`\>

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

> **getCommands**(`filter?`): `Promise`\<[`CommandRecord`](../interfaces/CommandRecord.md)\<`TLink`, `TCommand`, `unknown`\>[]\>

Get commands matching a filter.

#### Parameters

##### filter?

[`CommandFilter`](../interfaces/CommandFilter.md)

#### Returns

`Promise`\<[`CommandRecord`](../interfaces/CommandRecord.md)\<`TLink`, `TCommand`, `unknown`\>[]\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`getCommands`](../interfaces/IStorage.md#getcommands)

---

### getCommandsBlockedBy()

> **getCommandsBlockedBy**(`commandId`): `Promise`\<[`CommandRecord`](../interfaces/CommandRecord.md)\<`TLink`, `TCommand`, `unknown`\>[]\>

Get commands blocked by a specific command.

#### Parameters

##### commandId

`string`

#### Returns

`Promise`\<[`CommandRecord`](../interfaces/CommandRecord.md)\<`TLink`, `TCommand`, `unknown`\>[]\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`getCommandsBlockedBy`](../interfaces/IStorage.md#getcommandsblockedby)

---

### getCommandsByStatus()

> **getCommandsByStatus**(`status`): `Promise`\<[`CommandRecord`](../interfaces/CommandRecord.md)\<`TLink`, `TCommand`, `unknown`\>[]\>

Get commands by status.

#### Parameters

##### status

[`CommandStatus`](../type-aliases/CommandStatus.md) | [`CommandStatus`](../type-aliases/CommandStatus.md)[]

#### Returns

`Promise`\<[`CommandRecord`](../interfaces/CommandRecord.md)\<`TLink`, `TCommand`, `unknown`\>[]\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`getCommandsByStatus`](../interfaces/IStorage.md#getcommandsbystatus)

---

### getEvictableCacheKeys()

> **getEvictableCacheKeys**(`limit`): `Promise`\<[`CacheKeyRecord`](../interfaces/CacheKeyRecord.md)[]\>

Get cache keys eligible for eviction (leaf keys with holdCount = 0, not frozen or inheritedFrozen).

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

### getReadModelRevisions()

> **getReadModelRevisions**(`collection`): `Promise`\<`object`[]\>

Get all (id, revision) pairs for read models in a collection that have a non-null revision.
Used by SyncManager to restore knownRevisions on startup.

#### Parameters

##### collection

`string`

#### Returns

`Promise`\<`object`[]\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`getReadModelRevisions`](../interfaces/IStorage.md#getreadmodelrevisions)

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

[`IStorageQueryOptions`](../interfaces/IStorageQueryOptions.md)

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

### markCachedEventsProcessed()

> **markCachedEventsProcessed**(`ids`): `Promise`\<`void`\>

Mark cached events as processed by setting processed_at timestamp.

#### Parameters

##### ids

`string`[]

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`markCachedEventsProcessed`](../interfaces/IStorage.md#markcachedeventsprocessed)

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

### removeCacheKeyFromEvents()

> **removeCacheKeyFromEvents**(`cacheKey`): `Promise`\<`string`[]\>

Remove a cache key association from all events.
Deletes events that have no remaining cache key associations.
Returns the IDs of events that were fully deleted.

#### Parameters

##### cacheKey

`string`

#### Returns

`Promise`\<`string`[]\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`removeCacheKeyFromEvents`](../interfaces/IStorage.md#removecachekeyfromevents)

---

### removeCacheKeyFromReadModels()

> **removeCacheKeyFromReadModels**(`cacheKey`): `Promise`\<`void`\>

Remove a cache key association from all read models.
Deletes read models that have no remaining cache key associations.

#### Parameters

##### cacheKey

`string`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`removeCacheKeyFromReadModels`](../interfaces/IStorage.md#removecachekeyfromreadmodels)

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

[`CommandRecord`](../interfaces/CommandRecord.md)\<`TLink`, `TCommand`\>

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

`Partial`\<[`CommandRecord`](../interfaces/CommandRecord.md)\<`TLink`, `TCommand`\>\>

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IStorage`](../interfaces/IStorage.md).[`updateCommand`](../interfaces/IStorage.md#updatecommand)
