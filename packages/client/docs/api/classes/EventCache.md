[**@cqrs-toolkit/client**](../README.md)

***

[@cqrs-toolkit/client](../globals.md) / EventCache

# Class: EventCache

Defined in: packages/client/src/core/event-cache/EventCache.ts:40

Event cache implementation.

## Constructors

### Constructor

> **new EventCache**(`config`): `EventCache`

Defined in: packages/client/src/core/event-cache/EventCache.ts:45

#### Parameters

##### config

[`EventCacheConfig`](../interfaces/EventCacheConfig.md)

#### Returns

`EventCache`

## Methods

### cacheAnticipatedEvent()

> **cacheAnticipatedEvent**\<`T`\>(`event`, `options`): `Promise`\<`string`\>

Defined in: packages/client/src/core/event-cache/EventCache.ts:132

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

***

### cacheAnticipatedEvents()

> **cacheAnticipatedEvents**\<`T`\>(`events`, `options`): `Promise`\<`string`[]\>

Defined in: packages/client/src/core/event-cache/EventCache.ts:163

Cache multiple anticipated events for a command.

#### Type Parameters

##### T

`T`

#### Parameters

##### events

`Omit`\<[`AnticipatedEvent`](../interfaces/AnticipatedEvent.md)\<`T`\>, `"createdAt"` \| `"id"` \| `"persistence"`\>[]

Events to cache

##### options

[`CacheEventOptions`](../interfaces/CacheEventOptions.md) & `object`

Cache options (must include commandId)

#### Returns

`Promise`\<`string`[]\>

Generated event IDs

***

### cacheServerEvent()

> **cacheServerEvent**(`event`, `options`): `Promise`\<`boolean`\>

Defined in: packages/client/src/core/event-cache/EventCache.ts:58

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

***

### cacheServerEvents()

> **cacheServerEvents**(`events`, `options`): `Promise`\<`number`\>

Defined in: packages/client/src/core/event-cache/EventCache.ts:96

Cache multiple persisted events in batch.

#### Parameters

##### events

[`IPersistedEvent`](../type-aliases/IPersistedEvent.md)[]

Events to cache

##### options

[`CacheEventOptions`](../interfaces/CacheEventOptions.md)

Cache options

#### Returns

`Promise`\<`number`\>

Number of events cached (excludes duplicates)

***

### clearGapBuffer()

> **clearGapBuffer**(`streamId?`, `upToPosition?`): `void`

Defined in: packages/client/src/core/event-cache/EventCache.ts:328

Clear gap buffer.
With arguments: clears for a specific stream up to a position.
Without arguments: clears all gap tracking state.

#### Parameters

##### streamId?

`string`

Optional stream identifier

##### upToPosition?

`bigint`

Optional position to clear up to

#### Returns

`void`

***

### deleteAnticipatedEvents()

> **deleteAnticipatedEvents**(`commandId`): `Promise`\<`void`\>

Defined in: packages/client/src/core/event-cache/EventCache.ts:242

Delete anticipated events for a command.
Called when command succeeds/fails and anticipated events should be removed.

#### Parameters

##### commandId

`string`

Command identifier

#### Returns

`Promise`\<`void`\>

***

### getAnticipatedEventsByCommand()

> **getAnticipatedEventsByCommand**(`commandId`): `Promise`\<[`CachedEventRecord`](../interfaces/CachedEventRecord.md)[]\>

Defined in: packages/client/src/core/event-cache/EventCache.ts:232

Get anticipated events for a command.

#### Parameters

##### commandId

`string`

Command identifier

#### Returns

`Promise`\<[`CachedEventRecord`](../interfaces/CachedEventRecord.md)[]\>

Anticipated events

***

### getBufferedEvents()

> **getBufferedEvents**(`streamId`): `object`[]

Defined in: packages/client/src/core/event-cache/EventCache.ts:292

Get buffered events for a stream, sorted by revision.
Used during gap repair to process events in order.

#### Parameters

##### streamId

`string`

Stream identifier

#### Returns

`object`[]

Buffered events sorted by position/revision

***

### getEvent()

> **getEvent**(`id`): `Promise`\<[`CachedEventRecord`](../interfaces/CachedEventRecord.md) \| `null`\>

Defined in: packages/client/src/core/event-cache/EventCache.ts:202

Get a cached event by ID.

#### Parameters

##### id

`string`

Event ID

#### Returns

`Promise`\<[`CachedEventRecord`](../interfaces/CachedEventRecord.md) \| `null`\>

Cached event record or null

***

### getEventsByCacheKey()

> **getEventsByCacheKey**(`cacheKey`): `Promise`\<[`CachedEventRecord`](../interfaces/CachedEventRecord.md)[]\>

Defined in: packages/client/src/core/event-cache/EventCache.ts:212

Get all events for a cache key.

#### Parameters

##### cacheKey

`string`

Cache key identifier

#### Returns

`Promise`\<[`CachedEventRecord`](../interfaces/CachedEventRecord.md)[]\>

Cached events

***

### getEventsByStream()

> **getEventsByStream**(`streamId`): `Promise`\<[`CachedEventRecord`](../interfaces/CachedEventRecord.md)[]\>

Defined in: packages/client/src/core/event-cache/EventCache.ts:222

Get all events for a stream, sorted by position.

#### Parameters

##### streamId

`string`

Stream identifier

#### Returns

`Promise`\<[`CachedEventRecord`](../interfaces/CachedEventRecord.md)[]\>

Cached events in order

***

### getGaps()

> **getGaps**(): `Map`\<`string`, [`EventGap`](../interfaces/EventGap.md)[]\>

Defined in: packages/client/src/core/event-cache/EventCache.ts:271

Get detected gaps in the event stream.

#### Returns

`Map`\<`string`, [`EventGap`](../interfaces/EventGap.md)[]\>

Map of stream ID to gaps

***

### getStreamGaps()

> **getStreamGaps**(`streamId`): [`EventGap`](../interfaces/EventGap.md)[]

Defined in: packages/client/src/core/event-cache/EventCache.ts:281

Get detected gaps for a specific stream.

#### Parameters

##### streamId

`string`

Stream identifier

#### Returns

[`EventGap`](../interfaces/EventGap.md)[]

Gaps for the stream, empty array if none

***

### hasGaps()

> **hasGaps**(): `boolean`

Defined in: packages/client/src/core/event-cache/EventCache.ts:301

Check if there are any gaps in the event stream.

#### Returns

`boolean`

Whether there are gaps

***

### replaceAnticipatedWithConfirmed()

> **replaceAnticipatedWithConfirmed**(`commandId`, `confirmedEvents`, `cacheKey`): `Promise`\<`void`\>

Defined in: packages/client/src/core/event-cache/EventCache.ts:254

Replace anticipated events with confirmed server events.
Called when a command succeeds and server returns actual events.

#### Parameters

##### commandId

`string`

Command identifier

##### confirmedEvents

[`IPersistedEvent`](../type-aliases/IPersistedEvent.md)[]

Server-confirmed events

##### cacheKey

`string`

Cache key for the confirmed events

#### Returns

`Promise`\<`void`\>

***

### setKnownPosition()

> **setKnownPosition**(`streamId`, `position`): `void`

Defined in: packages/client/src/core/event-cache/EventCache.ts:316

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
