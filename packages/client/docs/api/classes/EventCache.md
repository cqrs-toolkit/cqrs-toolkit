[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../README.md) / EventCache

# Class: EventCache

Defined in: packages/client/src/core/event-cache/EventCache.ts:38

Event cache implementation.

## Constructors

### Constructor

> **new EventCache**(`config`): `EventCache`

Defined in: packages/client/src/core/event-cache/EventCache.ts:43

#### Parameters

##### config

[`EventCacheConfig`](../interfaces/EventCacheConfig.md)

#### Returns

`EventCache`

## Methods

### cacheAnticipatedEvent()

> **cacheAnticipatedEvent**\<`T`\>(`event`, `options`): `Promise`\<`string`\>

Defined in: packages/client/src/core/event-cache/EventCache.ts:137

Cache an anticipated event (optimistic local event).

#### Type Parameters

##### T

`T`

#### Parameters

##### event

`Omit`\<[`AnticipatedEvent`](../type-aliases/AnticipatedEvent.md)\<`T`\>, `"id"` \| `"createdAt"` \| `"persistence"`\>

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

Defined in: packages/client/src/core/event-cache/EventCache.ts:168

Cache multiple anticipated events for a command.

#### Type Parameters

##### T

`T`

#### Parameters

##### events

`Omit`\<[`AnticipatedEvent`](../type-aliases/AnticipatedEvent.md)\<`T`\>, `"createdAt"` \| `"id"` \| `"persistence"`\>[]

Events to cache

##### options

[`CacheEventOptions`](../interfaces/CacheEventOptions.md) & `object`

Cache options (must include commandId)

#### Returns

`Promise`\<`string`[]\>

Generated event IDs

---

### cacheServerEvent()

> **cacheServerEvent**\<`T`\>(`event`, `options`): `Promise`\<`boolean`\>

Defined in: packages/client/src/core/event-cache/EventCache.ts:56

Cache a server event (permanent or stateful).

#### Type Parameters

##### T

`T`

#### Parameters

##### event

[`ServerEvent`](../type-aliases/ServerEvent.md)\<`T`\>

Server event to cache

##### options

[`CacheEventOptions`](../interfaces/CacheEventOptions.md)

Cache options

#### Returns

`Promise`\<`boolean`\>

Whether the event was cached (false if duplicate)

---

### cacheServerEvents()

> **cacheServerEvents**\<`T`\>(`events`, `options`): `Promise`\<`number`\>

Defined in: packages/client/src/core/event-cache/EventCache.ts:96

Cache multiple server events in batch.

#### Type Parameters

##### T

`T`

#### Parameters

##### events

[`ServerEvent`](../type-aliases/ServerEvent.md)\<`T`\>[]

Events to cache

##### options

[`CacheEventOptions`](../interfaces/CacheEventOptions.md)

Cache options

#### Returns

`Promise`\<`number`\>

Number of events cached (excludes duplicates)

---

### clearGapBuffer()

> **clearGapBuffer**(`streamId?`, `upToPosition?`): `void`

Defined in: packages/client/src/core/event-cache/EventCache.ts:312

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

---

### deleteAnticipatedEvents()

> **deleteAnticipatedEvents**(`commandId`): `Promise`\<`void`\>

Defined in: packages/client/src/core/event-cache/EventCache.ts:247

Delete anticipated events for a command.
Called when command succeeds/fails and anticipated events should be removed.

#### Parameters

##### commandId

`string`

Command identifier

#### Returns

`Promise`\<`void`\>

---

### getAnticipatedEventsByCommand()

> **getAnticipatedEventsByCommand**(`commandId`): `Promise`\<[`CachedEventRecord`](../interfaces/CachedEventRecord.md)[]\>

Defined in: packages/client/src/core/event-cache/EventCache.ts:237

Get anticipated events for a command.

#### Parameters

##### commandId

`string`

Command identifier

#### Returns

`Promise`\<[`CachedEventRecord`](../interfaces/CachedEventRecord.md)[]\>

Anticipated events

---

### getEvent()

> **getEvent**(`id`): `Promise`\<[`CachedEventRecord`](../interfaces/CachedEventRecord.md) \| `null`\>

Defined in: packages/client/src/core/event-cache/EventCache.ts:207

Get a cached event by ID.

#### Parameters

##### id

`string`

Event ID

#### Returns

`Promise`\<[`CachedEventRecord`](../interfaces/CachedEventRecord.md) \| `null`\>

Cached event record or null

---

### getEventsByCacheKey()

> **getEventsByCacheKey**(`cacheKey`): `Promise`\<[`CachedEventRecord`](../interfaces/CachedEventRecord.md)[]\>

Defined in: packages/client/src/core/event-cache/EventCache.ts:217

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

Defined in: packages/client/src/core/event-cache/EventCache.ts:227

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

Defined in: packages/client/src/core/event-cache/EventCache.ts:276

Get detected gaps in the event stream.

#### Returns

`Map`\<`string`, [`EventGap`](../interfaces/EventGap.md)[]\>

Map of stream ID to gaps

---

### hasGaps()

> **hasGaps**(): `boolean`

Defined in: packages/client/src/core/event-cache/EventCache.ts:285

Check if there are any gaps in the event stream.

#### Returns

`boolean`

Whether there are gaps

---

### replaceAnticipatedWithConfirmed()

> **replaceAnticipatedWithConfirmed**\<`T`\>(`commandId`, `confirmedEvents`, `cacheKey`): `Promise`\<`void`\>

Defined in: packages/client/src/core/event-cache/EventCache.ts:259

Replace anticipated events with confirmed server events.
Called when a command succeeds and server returns actual events.

#### Type Parameters

##### T

`T`

#### Parameters

##### commandId

`string`

Command identifier

##### confirmedEvents

[`ServerEvent`](../type-aliases/ServerEvent.md)\<`T`\>[]

Server-confirmed events

##### cacheKey

`string`

Cache key for the confirmed events

#### Returns

`Promise`\<`void`\>

---

### setKnownPosition()

> **setKnownPosition**(`streamId`, `position`): `void`

Defined in: packages/client/src/core/event-cache/EventCache.ts:300

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
