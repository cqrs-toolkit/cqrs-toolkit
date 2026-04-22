[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / IStorage

# Interface: IStorage\<TLink, TCommand\>

Storage interface.
All methods are async to support both sync (in-memory) and async (SQLite) backends.

## Type Parameters

### TLink

`TLink` _extends_ `Link`

### TCommand

`TCommand` _extends_ [`EnqueueCommand`](EnqueueCommand.md)

## Methods

### addCacheKeysToEvents()

> **addCacheKeysToEvents**(`entries`): `Promise`\<`void`\>

Add cache-key associations to multiple existing events in a single
storage round-trip. Used when a WS drain batch contains events that
were already cached but under a different active cache-key set.

#### Parameters

##### entries

readonly `AddCacheKeysToEventEntry`[]

#### Returns

`Promise`\<`void`\>

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

---

### addCacheKeysToReadModels()

> **addCacheKeysToReadModels**(`entries`): `Promise`\<`void`\>

Add cache-key associations to multiple existing read models in a single
storage round-trip. Entries may span different collections; each
collection's junction table is written with its subset of rows.

#### Parameters

##### entries

readonly `AddCacheKeysToReadModelEntry`[]

#### Returns

`Promise`\<`void`\>

---

### beginTransaction()?

> `optional` **beginTransaction**(): `Promise`\<`unknown`\>

Begin a transaction.
Returns a transaction handle that can be passed to other methods.

#### Returns

`Promise`\<`unknown`\>

---

### clear()

> **clear**(): `Promise`\<`void`\>

Clear all data from storage.

#### Returns

`Promise`\<`void`\>

---

### close()

> **close**(): `Promise`\<`void`\>

Close the storage backend and release resources.

#### Returns

`Promise`\<`void`\>

---

### commitTransaction()?

> `optional` **commitTransaction**(`tx`): `Promise`\<`void`\>

Commit a transaction.

#### Parameters

##### tx

`unknown`

#### Returns

`Promise`\<`void`\>

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

---

### deleteAllCommandIdMappings()

> **deleteAllCommandIdMappings**(): `Promise`\<`void`\>

Delete all command ID mappings (e.g., on session clear).

#### Returns

`Promise`\<`void`\>

---

### deleteAllCommands()

> **deleteAllCommands**(): `Promise`\<`void`\>

Delete all commands (e.g., on session clear).

#### Returns

`Promise`\<`void`\>

---

### deleteAnticipatedEventsByCommand()

> **deleteAnticipatedEventsByCommand**(`commandId`): `Promise`\<`void`\>

Delete all anticipated events for a command.

#### Parameters

##### commandId

`string`

#### Returns

`Promise`\<`void`\>

---

### deleteAnticipatedEventsByCommands()

> **deleteAnticipatedEventsByCommands**(`commandIds`): `Promise`\<`void`\>

Delete all anticipated events for a set of commands in a single call.
Used by reconcile to clear stale overlays for every re-run command in
one storage round-trip.

#### Parameters

##### commandIds

readonly `string`[]

#### Returns

`Promise`\<`void`\>

---

### deleteCachedEvent()

> **deleteCachedEvent**(`id`): `Promise`\<`void`\>

Delete a cached event.

#### Parameters

##### id

`string`

#### Returns

`Promise`\<`void`\>

---

### deleteCacheKey()

> **deleteCacheKey**(`key`): `Promise`\<`void`\>

Delete a cache key and all associated data.

#### Parameters

##### key

`string`

#### Returns

`Promise`\<`void`\>

---

### deleteCacheKeys()

> **deleteCacheKeys**(`keys`): `Promise`\<`void`\>

Delete multiple cache keys and their associated events/read models in a batch.

#### Parameters

##### keys

`string`[]

#### Returns

`Promise`\<`void`\>

---

### deleteCommand()

> **deleteCommand**(`commandId`): `Promise`\<`void`\>

Delete a command.

#### Parameters

##### commandId

`string`

#### Returns

`Promise`\<`void`\>

---

### deleteCommandIdMappingsOlderThan()

> **deleteCommandIdMappingsOlderThan**(`timestamp`): `Promise`\<`void`\>

Delete command ID mappings older than a timestamp.

#### Parameters

##### timestamp

`number`

#### Returns

`Promise`\<`void`\>

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

---

### deleteReadModels()

> **deleteReadModels**(`entries`): `Promise`\<`void`\>

Delete multiple read model records in a single storage round-trip.
Entries may span different collections; each collection's data table
and cache-key junction table are deleted together.

#### Parameters

##### entries

readonly `DeleteReadModelEntry`[]

#### Returns

`Promise`\<`void`\>

---

### deleteReadModelsByCollection()

> **deleteReadModelsByCollection**(`collection`): `Promise`\<`void`\>

Delete all read model records for a collection.

#### Parameters

##### collection

`string`

#### Returns

`Promise`\<`void`\>

---

### deleteSession()

> **deleteSession**(): `Promise`\<`void`\>

Delete the current session and all associated data.

#### Returns

`Promise`\<`void`\>

---

### filterExistingCacheKeys()

> **filterExistingCacheKeys**(`keys`): `Promise`\<`string`[]\>

Filter an array of cache key strings to only those that exist in storage.

#### Parameters

##### keys

`string`[]

#### Returns

`Promise`\<`string`[]\>

---

### getAllAnticipatedEvents()

> **getAllAnticipatedEvents**(): `Promise`\<[`CachedEventRecord`](CachedEventRecord.md)[]\>

Get every cached event with `persistence === 'Anticipated'`. Used by
reconciliation to bulk-load all pending optimistic overlays in a single
query rather than N per-command queries.

#### Returns

`Promise`\<[`CachedEventRecord`](CachedEventRecord.md)[]\>

---

### getAllCacheKeys()

> **getAllCacheKeys**(): `Promise`\<[`CacheKeyRecord`](CacheKeyRecord.md)[]\>

Get all cache keys.

#### Returns

`Promise`\<[`CacheKeyRecord`](CacheKeyRecord.md)[]\>

---

### getAnticipatedEventsByCommand()

> **getAnticipatedEventsByCommand**(`commandId`): `Promise`\<[`CachedEventRecord`](CachedEventRecord.md)[]\>

Get anticipated events for a command.

#### Parameters

##### commandId

`string`

#### Returns

`Promise`\<[`CachedEventRecord`](CachedEventRecord.md)[]\>

---

### getCachedEvent()

> **getCachedEvent**(`id`): `Promise`\<[`CachedEventRecord`](CachedEventRecord.md) \| `undefined`\>

Get a cached event by ID.

#### Parameters

##### id

`string`

#### Returns

`Promise`\<[`CachedEventRecord`](CachedEventRecord.md) \| `undefined`\>

---

### getCachedEventsByCacheKey()

> **getCachedEventsByCacheKey**(`cacheKey`): `Promise`\<[`CachedEventRecord`](CachedEventRecord.md)[]\>

Get cached events for a cache key.

#### Parameters

##### cacheKey

`string`

#### Returns

`Promise`\<[`CachedEventRecord`](CachedEventRecord.md)[]\>

---

### getCachedEventsByStream()

> **getCachedEventsByStream**(`streamId`): `Promise`\<[`CachedEventRecord`](CachedEventRecord.md)[]\>

Get cached events for a stream.

#### Parameters

##### streamId

`string`

#### Returns

`Promise`\<[`CachedEventRecord`](CachedEventRecord.md)[]\>

---

### getCacheKey()

> **getCacheKey**(`key`): `Promise`\<[`CacheKeyRecord`](CacheKeyRecord.md) \| `undefined`\>

Get a cache key record.

#### Parameters

##### key

`string`

#### Returns

`Promise`\<[`CacheKeyRecord`](CacheKeyRecord.md) \| `undefined`\>

---

### getChildCacheKeys()

> **getChildCacheKeys**(`parentKey`): `Promise`\<[`CacheKeyRecord`](CacheKeyRecord.md)[]\>

Get child cache keys whose parentKey matches the given key.

#### Parameters

##### parentKey

`string`

#### Returns

`Promise`\<[`CacheKeyRecord`](CacheKeyRecord.md)[]\>

---

### getCommand()

> **getCommand**(`commandId`): `Promise`\<[`CommandRecord`](CommandRecord.md)\<`TLink`, `TCommand`, `unknown`\> \| `undefined`\>

Get a command by ID.

#### Parameters

##### commandId

`string`

#### Returns

`Promise`\<[`CommandRecord`](CommandRecord.md)\<`TLink`, `TCommand`, `unknown`\> \| `undefined`\>

---

### getCommandIdMapping()

> **getCommandIdMapping**(`clientId`): `Promise`\<`CommandIdMappingRecord` \| `undefined`\>

Get a command ID mapping by client ID.

#### Parameters

##### clientId

[`EntityId`](../type-aliases/EntityId.md)

#### Returns

`Promise`\<`CommandIdMappingRecord` \| `undefined`\>

---

### getCommandIdMappingByServerId()

> **getCommandIdMappingByServerId**(`serverId`): `Promise`\<`CommandIdMappingRecord` \| `undefined`\>

Get a command ID mapping by server ID.

#### Parameters

##### serverId

`string`

#### Returns

`Promise`\<`CommandIdMappingRecord` \| `undefined`\>

---

### getCommands()

> **getCommands**(`filter?`): `Promise`\<[`CommandRecord`](CommandRecord.md)\<`TLink`, `TCommand`, `unknown`\>[]\>

Get commands matching a filter.

#### Parameters

##### filter?

[`CommandFilter`](CommandFilter.md)

#### Returns

`Promise`\<[`CommandRecord`](CommandRecord.md)\<`TLink`, `TCommand`, `unknown`\>[]\>

---

### getCommandsBlockedBy()

> **getCommandsBlockedBy**(`commandId`): `Promise`\<[`CommandRecord`](CommandRecord.md)\<`TLink`, `TCommand`, `unknown`\>[]\>

Get commands blocked by a specific command.

#### Parameters

##### commandId

`string`

#### Returns

`Promise`\<[`CommandRecord`](CommandRecord.md)\<`TLink`, `TCommand`, `unknown`\>[]\>

---

### getCommandsByIds()

> **getCommandsByIds**(`commandIds`): `Promise`\<`Map`\<`string`, [`CommandRecord`](CommandRecord.md)\<`TLink`, `TCommand`, `unknown`\>\>\>

Batch-fetch commands by ID. Returns a `Map` keyed by commandId; absent
keys mean the command is not in storage. Callers relying on batch
semantics (e.g. CommandStore's `getByIds`) must prefer this over
iterated [getCommand](#getcommand) calls — SQLite runs a single
`WHERE command_id IN (...)` query.

#### Parameters

##### commandIds

readonly `string`[]

#### Returns

`Promise`\<`Map`\<`string`, [`CommandRecord`](CommandRecord.md)\<`TLink`, `TCommand`, `unknown`\>\>\>

---

### getCommandsByStatus()

> **getCommandsByStatus**(`status`): `Promise`\<[`CommandRecord`](CommandRecord.md)\<`TLink`, `TCommand`, `unknown`\>[]\>

Get commands by status.

#### Parameters

##### status

[`CommandStatus`](../type-aliases/CommandStatus.md) | [`CommandStatus`](../type-aliases/CommandStatus.md)[]

#### Returns

`Promise`\<[`CommandRecord`](CommandRecord.md)\<`TLink`, `TCommand`, `unknown`\>[]\>

---

### getCommandSequence()

> **getCommandSequence**(): `Promise`\<`number`\>

Get the current command sequence number. Used by CommandStore to initialize
its local sequence counter so new commands get monotonically increasing seq values.

- SQLiteStorage: reads MAX(seq) from the commands table (TODO: use sqlite_sequence for accuracy after deletes).
- InMemoryStorage: always returns 0 (nothing to load on startup).

#### Returns

`Promise`\<`number`\>

---

### getEvictableCacheKeys()

> **getEvictableCacheKeys**(`limit`): `Promise`\<[`CacheKeyRecord`](CacheKeyRecord.md)[]\>

Get cache keys eligible for eviction (leaf keys with holdCount = 0, not frozen or inheritedFrozen).

#### Parameters

##### limit

`number`

#### Returns

`Promise`\<[`CacheKeyRecord`](CacheKeyRecord.md)[]\>

---

### getExistingCachedEventIds()

> **getExistingCachedEventIds**(`ids`): `Promise`\<`Set`\<`string`\>\>

Partition a batch of event IDs by whether they already exist in the
cache. Returns the subset of ids that are already stored. Used by the
WS drain dedup pass to split a batch into "new" (continue processing)
and "already-seen" (just add cache-key associations and skip) without
hitting the store N times.

#### Parameters

##### ids

readonly `string`[]

#### Returns

`Promise`\<`Set`\<`string`\>\>

---

### getReadModel()

> **getReadModel**(`collection`, `id`): `Promise`\<[`ReadModelRecord`](ReadModelRecord.md) \| `undefined`\>

Get a read model record.

#### Parameters

##### collection

`string`

##### id

`string`

#### Returns

`Promise`\<[`ReadModelRecord`](ReadModelRecord.md) \| `undefined`\>

---

### getReadModelCount()

> **getReadModelCount**(): `Promise`\<`number`\>

Get the total count of read model records.

#### Returns

`Promise`\<`number`\>

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

---

### getReadModels()

> **getReadModels**(`pairs`): `Promise`\<`Map`\<`string`, [`ReadModelRecord`](ReadModelRecord.md)\>\>

Batch-fetch read model records for a set of `(collection, id)` pairs.
Returns a `Map` keyed by `${collection}:${id}`; missing rows are absent
from the map. Callers relying on batch semantics (e.g. the sync pipeline
and the CommandQueue success path) must prefer this over iterated
[getReadModel](#getreadmodel) calls.

TODO(batch): SQLite implementation should group by collection and run
one `WHERE id IN (...)` per collection. The in-memory implementation
remains a straight filter over its map.

#### Parameters

##### pairs

`Iterable`\<\{ `collection`: `string`; `id`: `string`; \}\>

#### Returns

`Promise`\<`Map`\<`string`, [`ReadModelRecord`](ReadModelRecord.md)\>\>

---

### getReadModelsByCacheKey()

> **getReadModelsByCacheKey**(`cacheKey`): `Promise`\<[`ReadModelRecord`](ReadModelRecord.md)[]\>

Get read model records by cache key.

#### Parameters

##### cacheKey

`string`

#### Returns

`Promise`\<[`ReadModelRecord`](ReadModelRecord.md)[]\>

---

### getReadModelsByCollection()

> **getReadModelsByCollection**(`collection`, `options?`): `Promise`\<[`ReadModelRecord`](ReadModelRecord.md)[]\>

Get all read model records for a collection.

#### Parameters

##### collection

`string`

##### options?

[`IStorageQueryOptions`](IStorageQueryOptions.md)

#### Returns

`Promise`\<[`ReadModelRecord`](ReadModelRecord.md)[]\>

---

### getSession()

> **getSession**(): `Promise`\<[`SessionRecord`](SessionRecord.md) \| `undefined`\>

Get the current session, if any.

#### Returns

`Promise`\<[`SessionRecord`](SessionRecord.md) \| `undefined`\>

---

### holdCacheKey()

> **holdCacheKey**(`key`): `Promise`\<`void`\>

Increment hold count for a cache key.

#### Parameters

##### key

`string`

#### Returns

`Promise`\<`void`\>

---

### initialize()

> **initialize**(): `Promise`\<`void`\>

Initialize the storage backend.
For SQLite, this creates tables and runs migrations.

#### Returns

`Promise`\<`void`\>

---

### loadAndPurgeCommandIdMappings()

> **loadAndPurgeCommandIdMappings**(`purgeOlderThan`): `Promise`\<`CommandIdMappingRecord`[]\>

Purge expired mappings and return all remaining mappings in a single
transaction. Used by `CommandIdMappingStore.initialize()` to hydrate its
in-memory state while also enforcing the TTL, without a second round trip.

Implementations execute (in order): delete WHERE created_at < `purgeOlderThan`,
then select all remaining records.

#### Parameters

##### purgeOlderThan

`number`

#### Returns

`Promise`\<`CommandIdMappingRecord`[]\>

---

### markCachedEventsProcessed()

> **markCachedEventsProcessed**(`ids`): `Promise`\<`void`\>

Mark cached events as processed by setting processed_at timestamp.

#### Parameters

##### ids

`string`[]

#### Returns

`Promise`\<`void`\>

---

### migrateReadModelIds()

> **migrateReadModelIds**(`batch`): `Promise`\<`void`\>

Rewrite a read-model row's primary key from `fromId` to `toId` and
update its data columns in the same operation. Also remaps any cache-key
junction entries so associations survive the id change.

The library's source of truth for "where data lives" is `(collection, id)`,
so an id migration is a primary-key change — not an insert-new + delete-old.
Implementations should perform the update in place (single `UPDATE` per
backing table) rather than copy + delete, to avoid transient missing rows
and to keep the round-trip count minimal.

No-op when no row exists at `(collection, fromId)`.

#### Parameters

##### batch

`MigrateReadModelIdParams`[]

#### Returns

`Promise`\<`void`\>

---

### releaseCacheKey()

> **releaseCacheKey**(`key`): `Promise`\<`void`\>

Decrement hold count for a cache key.

#### Parameters

##### key

`string`

#### Returns

`Promise`\<`void`\>

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

---

### rollbackTransaction()?

> `optional` **rollbackTransaction**(`tx`): `Promise`\<`void`\>

Rollback a transaction.

#### Parameters

##### tx

`unknown`

#### Returns

`Promise`\<`void`\>

---

### saveCachedEvent()

> **saveCachedEvent**(`event`): `Promise`\<`void`\>

Save a cached event.

#### Parameters

##### event

[`CachedEventRecord`](CachedEventRecord.md)

#### Returns

`Promise`\<`void`\>

---

### saveCachedEvents()

> **saveCachedEvents**(`events`): `Promise`\<`void`\>

Save multiple cached events in a batch.

#### Parameters

##### events

[`CachedEventRecord`](CachedEventRecord.md)[]

#### Returns

`Promise`\<`void`\>

---

### saveCacheKey()

> **saveCacheKey**(`record`): `Promise`\<`void`\>

Save or update a cache key.

#### Parameters

##### record

[`CacheKeyRecord`](CacheKeyRecord.md)

#### Returns

`Promise`\<`void`\>

---

### saveCacheKeys()

> **saveCacheKeys**(`records`): `Promise`\<`void`\>

Save multiple cache key records in a batch.

#### Parameters

##### records

[`CacheKeyRecord`](CacheKeyRecord.md)[]

#### Returns

`Promise`\<`void`\>

---

### saveCommand()

> **saveCommand**(`command`): `Promise`\<`void`\>

Save a new command.

#### Parameters

##### command

[`CommandRecord`](CommandRecord.md)\<`TLink`, `TCommand`\>

#### Returns

`Promise`\<`void`\>

---

### saveCommandIdMapping()

> **saveCommandIdMapping**(`record`): `Promise`\<`void`\>

Save a command ID mapping.

#### Parameters

##### record

`CommandIdMappingRecord`

#### Returns

`Promise`\<`void`\>

---

### saveCommandIdMappings()

> **saveCommandIdMappings**(`records`): `Promise`\<`void`\>

Save multiple command ID mappings in a single call.
Used by reconcile to persist the full idMap from a single WS batch.

#### Parameters

##### records

readonly `CommandIdMappingRecord`[]

#### Returns

`Promise`\<`void`\>

---

### saveReadModel()

> **saveReadModel**(`record`): `Promise`\<`void`\>

Save a read model record.

#### Parameters

##### record

[`ReadModelRecord`](ReadModelRecord.md)

#### Returns

`Promise`\<`void`\>

---

### saveReadModels()

> **saveReadModels**(`records`): `Promise`\<`void`\>

Save multiple read model records in a batch.

#### Parameters

##### records

[`ReadModelRecord`](ReadModelRecord.md)[]

#### Returns

`Promise`\<`void`\>

---

### saveSession()

> **saveSession**(`session`): `Promise`\<`void`\>

Save or update the session.

#### Parameters

##### session

[`SessionRecord`](SessionRecord.md)

#### Returns

`Promise`\<`void`\>

---

### touchCacheKey()

> **touchCacheKey**(`key`): `Promise`\<`void`\>

Touch a cache key (update lastAccessedAt).

#### Parameters

##### key

`string`

#### Returns

`Promise`\<`void`\>

---

### touchSession()

> **touchSession**(): `Promise`\<`void`\>

Update the last seen timestamp.

#### Returns

`Promise`\<`void`\>

---

### updateCommand()

> **updateCommand**(`commandId`, `updates`): `Promise`\<`void`\>

Update an existing command.

#### Parameters

##### commandId

`string`

##### updates

`Partial`\<[`CommandRecord`](CommandRecord.md)\<`TLink`, `TCommand`\>\>

#### Returns

`Promise`\<`void`\>

---

### updateCommands()

> **updateCommands**(`updates`): `Promise`\<`void`\>

Apply multiple command updates in a single call.
Each entry is applied independently — partial updates to `CommandRecord`
keyed by `commandId`. Used by reconcile workflows that need to save N
rewritten commands without N round-trips.

#### Parameters

##### updates

readonly `UpdateCommandsEntry`\<`TLink`, `TCommand`\>[]

#### Returns

`Promise`\<`void`\>
