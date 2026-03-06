[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / EventCache

# Class: EventCache

Defined in: [packages/client/src/core/event-cache/EventCache.ts:42](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/event-cache/EventCache.ts#L42)

Event cache implementation.

## Constructors

### Constructor

> **new EventCache**(`config`): `EventCache`

Defined in: [packages/client/src/core/event-cache/EventCache.ts:53](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/event-cache/EventCache.ts#L53)

#### Parameters

##### config

[`EventCacheConfig`](../interfaces/EventCacheConfig.md)

#### Returns

`EventCache`

## Methods

### cacheAnticipatedEvent()

> **cacheAnticipatedEvent**\<`T`\>(`event`, `options`): `Promise`\<`string`\>

Defined in: [packages/client/src/core/event-cache/EventCache.ts:147](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/event-cache/EventCache.ts#L147)

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

Defined in: [packages/client/src/core/event-cache/EventCache.ts:178](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/event-cache/EventCache.ts#L178)

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

Defined in: [packages/client/src/core/event-cache/EventCache.ts:363](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/event-cache/EventCache.ts#L363)

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

Defined in: [packages/client/src/core/event-cache/EventCache.ts:66](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/event-cache/EventCache.ts#L66)

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

Defined in: [packages/client/src/core/event-cache/EventCache.ts:109](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/event-cache/EventCache.ts#L109)

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

> **clearByCacheKey**(`cacheKey`): `string`[]

Defined in: [packages/client/src/core/event-cache/EventCache.ts:344](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/event-cache/EventCache.ts#L344)

Clear gap buffer entries for all streams associated with a cache key.
Returns the affected streamIds so callers can clean up their own per-stream state.

#### Parameters

##### cacheKey

`string`

Cache key to clear

#### Returns

`string`[]

Array of streamIds that were cleared

---

### clearGapBuffer()

> **clearGapBuffer**(`streamId?`, `upToPosition?`): `void`

Defined in: [packages/client/src/core/event-cache/EventCache.ts:324](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/event-cache/EventCache.ts#L324)

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

Defined in: [packages/client/src/core/event-cache/EventCache.ts:257](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/event-cache/EventCache.ts#L257)

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

Defined in: [packages/client/src/core/event-cache/EventCache.ts:391](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/event-cache/EventCache.ts#L391)

Destroy the event cache. Completes subscriptions and clears in-memory state.

#### Returns

`void`

---

### getAnticipatedEventsByCommand()

> **getAnticipatedEventsByCommand**(`commandId`): `Promise`\<[`CachedEventRecord`](../interfaces/CachedEventRecord.md)[]\>

Defined in: [packages/client/src/core/event-cache/EventCache.ts:247](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/event-cache/EventCache.ts#L247)

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

Defined in: [packages/client/src/core/event-cache/EventCache.ts:287](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/event-cache/EventCache.ts#L287)

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

Defined in: [packages/client/src/core/event-cache/EventCache.ts:217](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/event-cache/EventCache.ts#L217)

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

Defined in: [packages/client/src/core/event-cache/EventCache.ts:227](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/event-cache/EventCache.ts#L227)

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

Defined in: [packages/client/src/core/event-cache/EventCache.ts:237](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/event-cache/EventCache.ts#L237)

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

Defined in: [packages/client/src/core/event-cache/EventCache.ts:266](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/event-cache/EventCache.ts#L266)

Get detected gaps in the event stream.

#### Returns

`Map`\<`string`, [`EventGap`](../interfaces/EventGap.md)[]\>

Map of stream ID to gaps

---

### getStreamGaps()

> **getStreamGaps**(`streamId`): [`EventGap`](../interfaces/EventGap.md)[]

Defined in: [packages/client/src/core/event-cache/EventCache.ts:276](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/event-cache/EventCache.ts#L276)

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

Defined in: [packages/client/src/core/event-cache/EventCache.ts:296](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/event-cache/EventCache.ts#L296)

Check if there are any gaps in the event stream.

#### Returns

`boolean`

Whether there are gaps

---

### setKnownPosition()

> **setKnownPosition**(`streamId`, `position`): `void`

Defined in: [packages/client/src/core/event-cache/EventCache.ts:311](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/event-cache/EventCache.ts#L311)

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
