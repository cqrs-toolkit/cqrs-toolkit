[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / EventCache

# Class: EventCache\<TLink\>

Event cache implementation.

## Type Parameters

### TLink

`TLink` _extends_ `Link`

## Constructors

### Constructor

> **new EventCache**\<`TLink`\>(`config`): `EventCache`\<`TLink`\>

#### Parameters

##### config

[`EventCacheConfig`](../interfaces/EventCacheConfig.md)\<`TLink`\>

#### Returns

`EventCache`\<`TLink`\>

## Methods

### addCacheKeysToEvent()

> **addCacheKeysToEvent**(`eventId`, `cacheKeys`): `Promise`\<`void`\>

Add cache key associations to an existing event.
Used when a duplicate WS event is relevant to additional active cache keys.

#### Parameters

##### eventId

`string`

##### cacheKeys

`string`[]

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

`Omit`\<[`AnticipatedEvent`](../interfaces/AnticipatedEvent.md)\<`T`\>, `"id"` \| `"createdAt"` \| `"persistence"`\>[]

Events to cache

##### options

[`CacheEventOptions`](../interfaces/CacheEventOptions.md) & `object`

Cache options (must include commandId)

#### Returns

`Promise`\<`string`[]\>

Generated event IDs

---

### cacheResponseEvent()

> **cacheResponseEvent**(`event`): `Promise`\<`void`\>

Cache a command response event for WS dedup and immediate processing.
Constructs a CachedEventRecord from a ParsedEvent, saves to storage (INSERT OR IGNORE),
and adds to gap buffer for Permanent events.

#### Parameters

##### event

[`ParsedEvent`](../interfaces/ParsedEvent.md)

Parsed event from command response

#### Returns

`Promise`\<`void`\>

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

### cacheServerEvents()

> **cacheServerEvents**(`events`, `options`): `Promise`\<`number`\>

Cache multiple persisted events in batch.

Duplicates are silently ignored by the storage layer (INSERT OR IGNORE).

#### Parameters

##### events

[`IPersistedEvent`](../type-aliases/IPersistedEvent.md)[]

Events to cache

##### options

[`CacheEventOptions`](../interfaces/CacheEventOptions.md)

Cache options

#### Returns

`Promise`\<`number`\>

Number of events submitted (duplicates are silently skipped by storage)

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

### destroy()

> **destroy**(): `void`

Destroy the event cache. Completes subscriptions and clears in-memory state.

#### Returns

`void`

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
