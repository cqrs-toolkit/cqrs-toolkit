[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / EventCache

# Class: EventCache\<TLink, TCommand\>

Event cache implementation.

## Type Parameters

### TLink

`TLink` _extends_ `Link`

### TCommand

`TCommand` _extends_ [`EnqueueCommand`](../interfaces/EnqueueCommand.md)

## Constructors

### Constructor

> **new EventCache**\<`TLink`, `TCommand`\>(`storage`): `EventCache`\<`TLink`, `TCommand`\>

#### Parameters

##### storage

[`IStorage`](../interfaces/IStorage.md)\<`TLink`, `TCommand`\>

#### Returns

`EventCache`\<`TLink`, `TCommand`\>

## Methods

### addCacheKeysToEvents()

> **addCacheKeysToEvents**(`entries`): `Promise`\<`void`\>

Add cache-key associations to multiple already-cached events in a single
storage round-trip. Used when a WS drain batch contains events that
were previously cached under a different active cache-key set.

Each entry carries the full event because the in-memory
trackCacheKeyStream index needs `streamId` alongside the id —
passing the event avoids a re-fetch round-trip the caller already has
the data to avoid.

#### Parameters

##### entries

readonly `CacheServerEventEntry`[]

#### Returns

`Promise`\<`void`\>

---

### cacheAnticipatedEvent()

> **cacheAnticipatedEvent**\<`T`\>(`event`, `options`): `Promise`\<`string`\>

Cache an anticipated event (optimistic local event).

#### Type Parameters

##### T

`T`

#### Parameters

##### event

`Omit`\<[`AnticipatedEvent`](../interfaces/AnticipatedEvent.md)\<`T`\>, `"id"` \| `"createdAt"` \| `"persistence"`\>

Anticipated event to cache

##### options

[`CacheEventOptions`](../interfaces/CacheEventOptions.md) & `object`

Cache options (must include commandId)

#### Returns

`Promise`\<`string`\>

Generated event ID

---

### cacheAnticipatedEvents()

> **cacheAnticipatedEvents**\<`T`\>(`events`, `options`): `Promise`\<`string`[]\>

Cache multiple anticipated events for a command.

#### Type Parameters

##### T

`T`

#### Parameters

##### events

`Omit`\<[`AnticipatedEvent`](../interfaces/AnticipatedEvent.md)\<`T`\>, `"id"` \| `"persistence"` \| `"createdAt"`\>[]

Events to cache

##### options

[`CacheEventOptions`](../interfaces/CacheEventOptions.md) & `object`

Cache options (must include commandId)

#### Returns

`Promise`\<`string`[]\>

Generated event IDs

---

### cacheServerEvent()

> **cacheServerEvent**(`event`, `options`): `Promise`\<`boolean`\>

Cache a persisted event from the server.

#### Parameters

##### event

[`IPersistedEvent`](../type-aliases/IPersistedEvent.md)

Persisted event to cache

##### options

[`CacheEventOptions`](../interfaces/CacheEventOptions.md)

Cache options

#### Returns

`Promise`\<`boolean`\>

Whether the event was cached (false if duplicate)

---

### cacheServerEventsWithKeys()

> **cacheServerEventsWithKeys**(`entries`): `Promise`\<`number`\>

Cache multiple persisted events in a single storage round-trip. Each
entry carries its own cacheKeys, so a batch may mix events whose
cacheKey sets differ.

Duplicates are silently ignored by the storage layer (INSERT OR IGNORE).

#### Parameters

##### entries

readonly `CacheServerEventEntry`[]

Events to cache, each with its own cacheKeys

#### Returns

`Promise`\<`number`\>

Number of entries submitted (duplicates silently skipped by storage)

---

### clearByCacheKey()

> **clearByCacheKey**(`cacheKey`): `Promise`\<`string`[]\>

#### Parameters

##### cacheKey

`string`

#### Returns

`Promise`\<`string`[]\>

---

### clearGapBuffer()

> **clearGapBuffer**(`streamId?`, `upToPosition?`): `void`

Clear gap buffer.
With both arguments: clears for a specific stream up to a position.
With streamId only: clears all gap tracking state for that stream.
Without arguments: clears all gap tracking state and the cacheKeyStreams index.

#### Parameters

##### streamId?

`string`

Optional stream identifier

##### upToPosition?

`bigint`

Optional position to clear up to

#### Returns

`void`

---

### deleteAnticipatedEvents()

> **deleteAnticipatedEvents**(`commandId`): `Promise`\<`void`\>

Delete anticipated events for a command.
Called when command succeeds/fails and anticipated events should be removed.

#### Parameters

##### commandId

`string`

Command identifier

#### Returns

`Promise`\<`void`\>

---

### deleteAnticipatedEventsForCommands()

> **deleteAnticipatedEventsForCommands**(`commandIds`): `Promise`\<`void`\>

Delete anticipated events for multiple commands in a single storage
round-trip. Used by the applied-batch cleanup path in the sync pipeline.

#### Parameters

##### commandIds

readonly `string`[]

Command identifiers whose anticipated events should be removed

#### Returns

`Promise`\<`void`\>

---

### destroy()

> **destroy**(): `void`

#### Returns

`void`

---

### getAllAnticipatedEvents()

> **getAllAnticipatedEvents**(): `Promise`\<[`CachedEventRecord`](../interfaces/CachedEventRecord.md)[]\>

Get all anticipated events across every pending command.
Used by reconciliation to bulk-load optimistic overlays in a single query.

#### Returns

`Promise`\<[`CachedEventRecord`](../interfaces/CachedEventRecord.md)[]\>

---

### getAnticipatedEventsByCommand()

> **getAnticipatedEventsByCommand**(`commandId`): `Promise`\<[`CachedEventRecord`](../interfaces/CachedEventRecord.md)[]\>

Get anticipated events for a command.

#### Parameters

##### commandId

`string`

Command identifier

#### Returns

`Promise`\<[`CachedEventRecord`](../interfaces/CachedEventRecord.md)[]\>

Anticipated events

---

### getBufferedEvents()

> **getBufferedEvents**(`streamId`): `object`[]

Get buffered events for a stream, sorted by revision.
Used during gap repair to process events in order.

#### Parameters

##### streamId

`string`

Stream identifier

#### Returns

`object`[]

Buffered events sorted by position/revision

---

### getEvent()

> **getEvent**(`id`): `Promise`\<[`CachedEventRecord`](../interfaces/CachedEventRecord.md) \| `undefined`\>

Get a cached event by ID.

#### Parameters

##### id

`string`

Event ID

#### Returns

`Promise`\<[`CachedEventRecord`](../interfaces/CachedEventRecord.md) \| `undefined`\>

Cached event record or undefined

---

### getEventsByCacheKey()

> **getEventsByCacheKey**(`cacheKey`): `Promise`\<[`CachedEventRecord`](../interfaces/CachedEventRecord.md)[]\>

Get all events for a cache key.

#### Parameters

##### cacheKey

`string`

Cache key identifier

#### Returns

`Promise`\<[`CachedEventRecord`](../interfaces/CachedEventRecord.md)[]\>

Cached events

---

### getEventsByStream()

> **getEventsByStream**(`streamId`): `Promise`\<[`CachedEventRecord`](../interfaces/CachedEventRecord.md)[]\>

Get all events for a stream, sorted by position.

#### Parameters

##### streamId

`string`

Stream identifier

#### Returns

`Promise`\<[`CachedEventRecord`](../interfaces/CachedEventRecord.md)[]\>

Cached events in order

---

### getExistingEventIds()

> **getExistingEventIds**(`ids`): `Promise`\<`Set`\<`string`\>\>

Bulk existence check — returns the subset of ids that are already
stored in the cache. Used by the WS drain dedup pass to partition a
batch into "new" vs "already-seen" without N round-trips.

#### Parameters

##### ids

readonly `string`[]

Candidate event IDs

#### Returns

`Promise`\<`Set`\<`string`\>\>

Set of ids that are already present

---

### getGaps()

> **getGaps**(): `Map`\<`string`, [`EventGap`](../interfaces/EventGap.md)[]\>

Get detected gaps in the event stream.

#### Returns

`Map`\<`string`, [`EventGap`](../interfaces/EventGap.md)[]\>

Map of stream ID to gaps

---

### getStreamGaps()

> **getStreamGaps**(`streamId`): [`EventGap`](../interfaces/EventGap.md)[]

Get detected gaps for a specific stream.

#### Parameters

##### streamId

`string`

Stream identifier

#### Returns

[`EventGap`](../interfaces/EventGap.md)[]

Gaps for the stream, empty array if none

---

### hasGaps()

> **hasGaps**(): `boolean`

Check if there are any gaps in the event stream.

#### Returns

`boolean`

Whether there are gaps

---

### markProcessed()

> **markProcessed**(`ids`): `Promise`\<`void`\>

Mark events as processed. Sets processedAt timestamp for TTL-based cleanup.

#### Parameters

##### ids

`string`[]

#### Returns

`Promise`\<`void`\>

---

### setKnownPosition()

> **setKnownPosition**(`streamId`, `position`): `void`

Set the known highest position for a stream.
Used when resuming from persisted state.

#### Parameters

##### streamId

`string`

Stream identifier

##### position

`bigint`

Known highest position

#### Returns

`void`

---

### startCleanup()

> **startCleanup**(`intervalMs?`, `ttlMs?`): `void`

Start periodic cleanup of processed events.
Deletes events where processedAt is older than ttlMs.

#### Parameters

##### intervalMs?

`number` = `60_000`

How often to run cleanup (default 60s)

##### ttlMs?

`number` = `...`

Grace window before deletion (default 5 minutes)

#### Returns

`void`
