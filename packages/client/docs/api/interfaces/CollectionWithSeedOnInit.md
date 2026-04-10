[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / CollectionWithSeedOnInit

# Interface: CollectionWithSeedOnInit\<TLink\>

A synchronized event collection.

Collections define how the library discovers, fetches, and routes events.
Consumer code implements the fetch methods to control HTTP conventions.

Parameterized on `TLink` so multi-service apps using `ServiceLink`
get typed entity cache keys with required `service` field.

This currently operates one-to-one with Aggregate.
Support for composite collections that are built from multiple aggregates are being considered for a future release.

## Extends

- [`Collection`](Collection.md)\<`TLink`\>

## Type Parameters

### TLink

`TLink` _extends_ `Link`

## Properties

### aggregate

> **aggregate**: [`AggregateConfig`](../type-aliases/AggregateConfig.md)\<`TLink`\>

#### Inherited from

[`Collection`](Collection.md).[`aggregate`](Collection.md#aggregate)

---

### idReferences?

> `optional` **idReferences**: `IdReference`\<`TLink`\>[]

#### Inherited from

[`Collection`](Collection.md).[`idReferences`](Collection.md#idreferences)

---

### name

> `readonly` **name**: `string`

#### Inherited from

[`Collection`](Collection.md).[`name`](Collection.md#name)

---

### seedOnDemand?

> `readonly` `optional` **seedOnDemand**: [`SeedOnDemandConfig`](SeedOnDemandConfig.md)\<`TLink`\>

On-demand seeding configuration.
If undefined, this collection does not support on-demand (lazily-loaded) seeding.

#### Inherited from

[`Collection`](Collection.md).[`seedOnDemand`](Collection.md#seedondemand)

---

### seedOnInit

> `readonly` **seedOnInit**: [`SeedOnInitConfig`](SeedOnInitConfig.md)\<`TLink`\>

Auto-seed this collection on startup.
If undefined, this collection is not seeded on init — data must be
loaded on demand (e.g., via consumer-driven seeding on navigation).

#### Overrides

[`Collection`](Collection.md).[`seedOnInit`](Collection.md#seedoninit)

---

### seedPageSize?

> `readonly` `optional` **seedPageSize**: `number`

Page size for seeding. Default: 100.

#### Inherited from

[`Collection`](Collection.md).[`seedPageSize`](Collection.md#seedpagesize)

## Methods

### cacheKeysFromTopics()

> **cacheKeysFromTopics**(`topics`): ([`CacheKeyIdentity`](../type-aliases/CacheKeyIdentity.md)\<`TLink`\> \| [`CacheKeyTemplate`](../type-aliases/CacheKeyTemplate.md)\<`TLink`\>)[]

Derive cache key identities from WS event topics.
Called at WS ingestion to resolve which cache keys an event belongs to.
The returned identities are attached to the event before processing —
no further topic resolution happens downstream.

#### Parameters

##### topics

readonly `string`[]

Topic strings from the WS event message

#### Returns

([`CacheKeyIdentity`](../type-aliases/CacheKeyIdentity.md)\<`TLink`\> \| [`CacheKeyTemplate`](../type-aliases/CacheKeyTemplate.md)\<`TLink`\>)[]

Cache key identities or templates. Templates (no `.key`) are resolved
by the caller via `registerCacheKeySync`.

#### Inherited from

[`Collection`](Collection.md).[`cacheKeysFromTopics`](Collection.md#cachekeysfromtopics)

---

### fetchSeedEvents()?

> `optional` **fetchSeedEvents**(`opts`): `Promise`\<[`SeedEventPage`](SeedEventPage.md)\>

Fetch a page of events for initial seeding (fallback).
Events are processed through event processors to build read models.
Prefer fetchSeedRecords when the server provides read model endpoints.

Only used if fetchSeedRecords is not defined.

#### Parameters

##### opts

[`FetchSeedEventOptions`](FetchSeedEventOptions.md)\<`TLink`\>

#### Returns

`Promise`\<[`SeedEventPage`](SeedEventPage.md)\>

#### Inherited from

[`Collection`](Collection.md).[`fetchSeedEvents`](Collection.md#fetchseedevents)

---

### fetchSeedRecords()?

> `optional` **fetchSeedRecords**(`opts`): `Promise`\<[`SeedRecordPage`](SeedRecordPage.md)\>

Fetch a page of pre-computed read model records for initial seeding.
This is the primary seeding mechanism — records go directly into the
read model store without event processing.

If undefined, falls back to fetchSeedEvents (event-based seeding).
If neither is defined, seeding is skipped for this collection.

#### Parameters

##### opts

[`FetchSeedRecordOptions`](FetchSeedRecordOptions.md)\<`TLink`\>

#### Returns

`Promise`\<[`SeedRecordPage`](SeedRecordPage.md)\>

#### Inherited from

[`Collection`](Collection.md).[`fetchSeedRecords`](Collection.md#fetchseedrecords)

---

### fetchStreamEvents()?

> `optional` **fetchStreamEvents**(`opts`): `Promise`\<[`IPersistedEvent`](../type-aliases/IPersistedEvent.md)[]\>

Fetch per-stream events for gap recovery and command response processing.
If undefined, gap recovery processes buffered events as-is (lossy).

#### Parameters

##### opts

[`FetchStreamEventOptions`](FetchStreamEventOptions.md)

#### Returns

`Promise`\<[`IPersistedEvent`](../type-aliases/IPersistedEvent.md)[]\>

#### Inherited from

[`Collection`](Collection.md).[`fetchStreamEvents`](Collection.md#fetchstreamevents)

---

### matchesStream()

> **matchesStream**(`streamId`): `boolean`

Test whether a streamId belongs to this collection.
Called for WS events and command response events to route them.
Multiple collections may match the same streamId.

#### Parameters

##### streamId

`string`

#### Returns

`boolean`

#### Inherited from

[`Collection`](Collection.md).[`matchesStream`](Collection.md#matchesstream)
