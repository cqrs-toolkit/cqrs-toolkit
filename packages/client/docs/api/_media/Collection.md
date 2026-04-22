[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / Collection

# Interface: Collection\<TLink\>

A synchronized event collection backed by exactly one primary aggregate.

Collections define how the library discovers, fetches, and routes events.
Consumer code implements the fetch methods to control HTTP conventions.

Parameterized on `TLink` so multi-service apps using `ServiceLink`
get typed entity cache keys with required `service` field.

The 1-to-1 relationship with an aggregate is enforced by the required
`aggregate` field. A separate `CompositeCollection` type built from multiple
aggregates is future work, pending a strong example case to design against —
it will not be a variant of this interface.

## Extended by

- [`CollectionWithSeedOnDemand`](CollectionWithSeedOnDemand.md)
- [`CollectionWithSeedOnInit`](CollectionWithSeedOnInit.md)

## Type Parameters

### TLink

`TLink` _extends_ `Link`

## Properties

### aggregate

> `readonly` **aggregate**: [`AggregateConfig`](AggregateConfig.md)\<`TLink`\>

The primary aggregate this collection tracks.
Provides stream ID derivation and aggregate identity (type, service for ServiceLink).

---

### idReferences?

> `readonly` `optional` **idReferences**: readonly [`IdReference`](../type-aliases/IdReference.md)\<`TLink`\>[]

Declares which paths in this collection's read model data contain references
to aggregate IDs or links. Used by the event processor for overlay event reconciliation
when an anticipated create resolves to a server ID.

Each entry is either a [DirectIdReference](DirectIdReference.md) (path points at a plain string ID)
or a [LinkIdReference](LinkIdReference.md) (path points at a `Link` object whose `type`/`service`
are validated against the declared aggregates before its `id` is rewritten).

The self-ID at `$.id` is injected automatically by `resolveConfig` using this
collection's `aggregate` — no need to declare it manually. You must declare all other
references to an aggregate id/link (e.g. `notebookId` on a Note pointing at the Notebook aggregate).

---

### name

> `readonly` **name**: `string`

---

### revisionPath?

> `readonly` `optional` **revisionPath**: `string`

JSONPath into the read model data where the aggregate's stream revision lives.
Used to advance `AggregateChain.lastKnownRevision` when server data arrives via
seed, refetch, or snapshot — so subsequent AutoRevision commands resolve against
the latest confirmed revision, not a stale command-success value.

Examples: `'$.revision'`, `'$.latestRevision'`.
Absent means chain revision is not updated from read model records (only from
WS events and command responses).

---

### seedOnDemand?

> `readonly` `optional` **seedOnDemand**: [`SeedOnDemandConfig`](SeedOnDemandConfig.md)\<`TLink`\>

On-demand seeding configuration.
If undefined, this collection does not support on-demand (lazily-loaded) seeding.

---

### seedOnInit?

> `readonly` `optional` **seedOnInit**: [`SeedOnInitConfig`](SeedOnInitConfig.md)\<`TLink`\>

Auto-seed this collection on startup.
If undefined, this collection is not seeded on init — data must be
loaded on demand (e.g., via consumer-driven seeding on navigation).

---

### seedPageSize?

> `readonly` `optional` **seedPageSize**: `number`

Page size for seeding. Default: 100.

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
