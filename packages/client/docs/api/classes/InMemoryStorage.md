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

- `IWindowStorage`\<`TLink`, `TCommand`\>

## Constructors

### Constructor

> **new InMemoryStorage**\<`TLink`, `TCommand`\>(`config?`): `InMemoryStorage`\<`TLink`, `TCommand`\>

#### Parameters

##### config?

`InMemoryStorageConfig` = `{}`

#### Returns

`InMemoryStorage`\<`TLink`, `TCommand`\>

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

#### Implementation of

`IWindowStorage.addCacheKeysToEvents`

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

`IWindowStorage.addCacheKeysToReadModel`

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

#### Implementation of

`IWindowStorage.addCacheKeysToReadModels`

---

### clear()

> **clear**(): `Promise`\<`void`\>

Clear all data from storage.

#### Returns

`Promise`\<`void`\>

#### Implementation of

`IWindowStorage.clear`

---

### close()

> **close**(): `Promise`\<`void`\>

Close the storage backend and release resources.

#### Returns

`Promise`\<`void`\>

#### Implementation of

`IWindowStorage.close`

---

### countReadModels()

> **countReadModels**(`collection`, `cacheKey?`, `filter?`): `Promise`\<`number`\>

Count read model records in a collection, optionally filtered by
cache key and a user fragment. When a IStorageListFilter
is supplied, both the cache-key clause and the user fragment are
applied; the returned count reflects the filtered subset so list
totals stay coherent with the page result.

#### Parameters

##### collection

`string`

##### cacheKey?

`string`

##### filter?

`IStorageListFilter`

#### Returns

`Promise`\<`number`\>

#### Implementation of

`IWindowStorage.countReadModels`

---

### deleteAllCommandIdMappings()

> **deleteAllCommandIdMappings**(): `Promise`\<`void`\>

Delete all command ID mappings (e.g., on session clear).

#### Returns

`Promise`\<`void`\>

#### Implementation of

`IWindowStorage.deleteAllCommandIdMappings`

---

### deleteAllCommands()

> **deleteAllCommands**(): `Promise`\<`void`\>

Delete all commands (e.g., on session clear).

#### Returns

`Promise`\<`void`\>

#### Implementation of

`IWindowStorage.deleteAllCommands`

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

`IWindowStorage.deleteAnticipatedEventsByCommand`

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

#### Implementation of

`IWindowStorage.deleteAnticipatedEventsByCommands`

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

`IWindowStorage.deleteCachedEvent`

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

`IWindowStorage.deleteCacheKey`

---

### deleteCacheKeys()

> **deleteCacheKeys**(`keys`): `Promise`\<`void`\>

Delete multiple cache keys and their associated events/read models in a batch.

#### Parameters

##### keys

`string`[]

#### Returns

`Promise`\<`void`\>

#### Implementation of

`IWindowStorage.deleteCacheKeys`

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

`IWindowStorage.deleteCommand`

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

`IWindowStorage.deleteCommandIdMappingsOlderThan`

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

`IWindowStorage.deleteProcessedCachedEvents`

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

`IWindowStorage.deleteReadModel`

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

#### Implementation of

`IWindowStorage.deleteReadModels`

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

`IWindowStorage.deleteReadModelsByCollection`

---

### deleteSession()

> **deleteSession**(): `Promise`\<`void`\>

Delete the current session and all associated data.

#### Returns

`Promise`\<`void`\>

#### Implementation of

`IWindowStorage.deleteSession`

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

`IWindowStorage.filterExistingCacheKeys`

---

### getAllAnticipatedEvents()

> **getAllAnticipatedEvents**(): `Promise`\<[`CachedEventRecord`](../interfaces/CachedEventRecord.md)[]\>

Get every cached event with `persistence === 'Anticipated'`. Used by
reconciliation to bulk-load all pending optimistic overlays in a single
query rather than N per-command queries.

#### Returns

`Promise`\<[`CachedEventRecord`](../interfaces/CachedEventRecord.md)[]\>

#### Implementation of

`IWindowStorage.getAllAnticipatedEvents`

---

### getAllCacheKeys()

> **getAllCacheKeys**(): `Promise`\<[`CacheKeyRecord`](../interfaces/CacheKeyRecord.md)[]\>

Get all cache keys.

#### Returns

`Promise`\<[`CacheKeyRecord`](../interfaces/CacheKeyRecord.md)[]\>

#### Implementation of

`IWindowStorage.getAllCacheKeys`

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

`IWindowStorage.getAnticipatedEventsByCommand`

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

`IWindowStorage.getCachedEvent`

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

`IWindowStorage.getCachedEventsByCacheKey`

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

`IWindowStorage.getCachedEventsByStream`

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

`IWindowStorage.getCacheKey`

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

`IWindowStorage.getChildCacheKeys`

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

`IWindowStorage.getCommand`

---

### getCommandIdMapping()

> **getCommandIdMapping**(`clientId`): `Promise`\<`CommandIdMappingRecord` \| `undefined`\>

Get a command ID mapping by client ID.

#### Parameters

##### clientId

[`EntityId`](../type-aliases/EntityId.md)

#### Returns

`Promise`\<`CommandIdMappingRecord` \| `undefined`\>

#### Implementation of

`IWindowStorage.getCommandIdMapping`

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

`IWindowStorage.getCommandIdMappingByServerId`

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

`IWindowStorage.getCommands`

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

`IWindowStorage.getCommandsBlockedBy`

---

### getCommandsByIds()

> **getCommandsByIds**(`commandIds`): `Promise`\<`Map`\<`string`, [`CommandRecord`](../interfaces/CommandRecord.md)\<`TLink`, `TCommand`, `unknown`\>\>\>

Batch-fetch commands by ID. Returns a `Map` keyed by commandId; absent
keys mean the command is not in storage. Callers relying on batch
semantics (e.g. CommandStore's `getByIds`) must prefer this over
iterated [getCommand](../interfaces/IStorage.md#getcommand) calls — SQLite runs a single
`WHERE command_id IN (...)` query.

#### Parameters

##### commandIds

readonly `string`[]

#### Returns

`Promise`\<`Map`\<`string`, [`CommandRecord`](../interfaces/CommandRecord.md)\<`TLink`, `TCommand`, `unknown`\>\>\>

#### Implementation of

`IWindowStorage.getCommandsByIds`

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

`IWindowStorage.getCommandsByStatus`

---

### getCommandSequence()

> **getCommandSequence**(): `Promise`\<`number`\>

Get the current command sequence number. Used by CommandStore to initialize
its local sequence counter so new commands get monotonically increasing seq values.

- SQLiteStorage: reads MAX(seq) from the commands table (TODO: use sqlite_sequence for accuracy after deletes).
- InMemoryStorage: always returns 0 (nothing to load on startup).

#### Returns

`Promise`\<`number`\>

#### Implementation of

`IWindowStorage.getCommandSequence`

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

`IWindowStorage.getEvictableCacheKeys`

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

#### Implementation of

`IWindowStorage.getExistingCachedEventIds`

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

`IWindowStorage.getReadModel`

---

### getReadModelCount()

> **getReadModelCount**(): `Promise`\<`number`\>

Get the total count of read model records.

#### Returns

`Promise`\<`number`\>

#### Implementation of

`IWindowStorage.getReadModelCount`

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

`IWindowStorage.getReadModelRevisions`

---

### getReadModels()

> **getReadModels**(`pairs`): `Promise`\<`Map`\<`string`, [`ReadModelRecord`](../interfaces/ReadModelRecord.md)\>\>

Batch-fetch read model records for a set of `(collection, id)` pairs.
Returns a `Map` keyed by `${collection}:${id}`; missing rows are absent
from the map. Callers relying on batch semantics (e.g. the sync pipeline
and the CommandQueue success path) must prefer this over iterated
[getReadModel](../interfaces/IStorage.md#getreadmodel) calls.

TODO(batch): SQLite implementation should group by collection and run
one `WHERE id IN (...)` per collection. The in-memory implementation
remains a straight filter over its map.

#### Parameters

##### pairs

`Iterable`\<\{ `collection`: `string`; `id`: `string`; \}\>

#### Returns

`Promise`\<`Map`\<`string`, [`ReadModelRecord`](../interfaces/ReadModelRecord.md)\>\>

#### Implementation of

`IWindowStorage.getReadModels`

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

`IWindowStorage.getReadModelsByCacheKey`

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

`IWindowStorage.getReadModelsByCollection`

---

### getSession()

> **getSession**(): `Promise`\<[`SessionRecord`](../interfaces/SessionRecord.md) \| `undefined`\>

Get the current session, if any.

#### Returns

`Promise`\<[`SessionRecord`](../interfaces/SessionRecord.md) \| `undefined`\>

#### Implementation of

`IWindowStorage.getSession`

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

`IWindowStorage.holdCacheKey`

---

### initialize()

> **initialize**(): `Promise`\<`void`\>

Initialize the storage backend.
For SQLite, this creates tables and runs migrations.

#### Returns

`Promise`\<`void`\>

#### Implementation of

`IWindowStorage.initialize`

---

### iterateReadModels()

> **iterateReadModels**\<`T`\>(`collection`): `Generator`\<\{ `data`: `T`; `hasLocalChanges`: `boolean`; `id`: `string`; \}\>

Sync iteration over read-models in a collection — Mode-A-only contract
for view dispatch. Not part of [IStorage](../interfaces/IStorage.md); SQLite-backed storage
doesn't expose this surface.

Yields each record's parsed `effectiveData` along with id and
`hasLocalChanges`. Iteration order is the underlying `Map` insertion
order; consumers that need a specific order build their own index.

Returns `Iterable<...>` (not `IterableIterator`) so the consumer's
memory closure can choose to use `for...of` directly or pass the
iterable to other consumers (e.g. `new Map(api.iterate(...))`-style).

#### Type Parameters

##### T

`T`

#### Parameters

##### collection

`string`

#### Returns

`Generator`\<\{ `data`: `T`; `hasLocalChanges`: `boolean`; `id`: `string`; \}\>

#### Implementation of

`IWindowStorage.iterateReadModels`

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

#### Implementation of

`IWindowStorage.loadAndPurgeCommandIdMappings`

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

`IWindowStorage.markCachedEventsProcessed`

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

#### Implementation of

`IWindowStorage.migrateReadModelIds`

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

`IWindowStorage.releaseCacheKey`

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

`IWindowStorage.removeCacheKeyFromEvents`

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

`IWindowStorage.removeCacheKeyFromReadModels`

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

`IWindowStorage.saveCachedEvent`

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

`IWindowStorage.saveCachedEvents`

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

`IWindowStorage.saveCacheKey`

---

### saveCacheKeys()

> **saveCacheKeys**(`records`): `Promise`\<`void`\>

Save multiple cache key records in a batch.

#### Parameters

##### records

[`CacheKeyRecord`](../interfaces/CacheKeyRecord.md)[]

#### Returns

`Promise`\<`void`\>

#### Implementation of

`IWindowStorage.saveCacheKeys`

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

`IWindowStorage.saveCommand`

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

`IWindowStorage.saveCommandIdMapping`

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

#### Implementation of

`IWindowStorage.saveCommandIdMappings`

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

`IWindowStorage.saveReadModel`

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

`IWindowStorage.saveReadModels`

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

`IWindowStorage.saveSession`

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

`IWindowStorage.touchCacheKey`

---

### touchSession()

> **touchSession**(): `Promise`\<`void`\>

Update the last seen timestamp.

#### Returns

`Promise`\<`void`\>

#### Implementation of

`IWindowStorage.touchSession`

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

`IWindowStorage.updateCommand`

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

#### Implementation of

`IWindowStorage.updateCommands`
