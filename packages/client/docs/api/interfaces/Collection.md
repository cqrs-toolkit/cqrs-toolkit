[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / Collection

# Interface: Collection\<TLink\>

A synchronized event collection.

Collections define how the library discovers, fetches, and routes events.
Consumer code implements the fetch methods to control HTTP conventions.

Parameterized on `TLink` so multi-service apps using `ServiceLink`
get typed entity cache keys with required `service` field.

## Type Parameters

### TLink

`TLink` _extends_ `Link`

## Properties

### name

> `readonly` **name**: `string`

---

### seedCacheKey?

> `readonly` `optional` **seedCacheKey**: [`CacheKeyIdentity`](../type-aliases/CacheKeyIdentity.md)\<`TLink`\>

Cache key identity to auto-seed on startup.
If undefined, this collection is not seeded on init — data must be
loaded on demand (e.g., via consumer-driven seeding on navigation).

---

### seedPageSize?

> `readonly` `optional` **seedPageSize**: `number`

Page size for seeding. Default: 100.

## Methods

### fetchSeedEvents()?

> `optional` **fetchSeedEvents**(`opts`): `Promise`\<[`SeedEventPage`](SeedEventPage.md)\>

Fetch a page of events for initial seeding (fallback).
Events are processed through event processors to build read models.
Prefer fetchSeedRecords when the server provides read model endpoints.

Only used if fetchSeedRecords is not defined.

#### Parameters

##### opts

[`FetchSeedEventOptions`](FetchSeedEventOptions.md)

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

[`FetchSeedRecordOptions`](FetchSeedRecordOptions.md)

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

### getStreamId()?

> `optional` **getStreamId**(`entityId`): `string`

Derive stream ID from entity ID.
Used to restore knownRevisions from persisted read model revisions on startup
and to populate knownRevisions during record-based seeding.

## 1:1 aggregate assumption

Revision tracking assumes each read model entity maps to exactly one domain
aggregate (stream). The read model's `_revision` column stores a single scalar
(the aggregate's stream revision), and this function maps entity → stream.

Composite read models — entities built from events across multiple aggregates —
should omit this function and do not participate in per-stream revision tracking.
If composite read models are introduced, the following need extension:

- `ReadModelRecord.revision` / `_revision` column — scalar → per-aggregate map
- `ReadModel<T>.revision` — scalar → structured type
- This function — single return → multiple, or replaced
- `SyncManager.restoreKnownRevisions` — iterate map entries per entity
- `EventProcessorRunner.applyResult` — `RevisionMeta` would carry stream identity
- `SeedRecord.revision` — scalar → per-aggregate map

#### Parameters

##### entityId

`string`

#### Returns

`string`

---

### getTopics()

> **getTopics**(): `string`[]

WS topic patterns to subscribe to. Return [] for no subscription.

#### Returns

`string`[]

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
