[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / Collection

# Interface: Collection

A synchronized event collection.

Collections define how the library discovers, fetches, and routes events.
Consumer code implements the fetch methods to control HTTP conventions.

## Properties

### name

> `readonly` **name**: `string`

---

### seedOnInit?

> `readonly` `optional` **seedOnInit**: `boolean`

Whether to seed on initial sync. Default: true.

---

### seedPageSize?

> `readonly` `optional` **seedPageSize**: `number`

Page size for seeding. Default: 100.

## Methods

### fetchSeedEvents()?

> `optional` **fetchSeedEvents**(`ctx`, `cursor`, `limit`): `Promise`\<[`SeedEventPage`](SeedEventPage.md)\>

Fetch a page of events for initial seeding (fallback).
Events are processed through event processors to build read models.
Prefer fetchSeedRecords when the server provides read model endpoints.

Only used if fetchSeedRecords is not defined.

#### Parameters

##### ctx

[`FetchContext`](FetchContext.md)

##### cursor

`string` | `null`

##### limit

`number`

#### Returns

`Promise`\<[`SeedEventPage`](SeedEventPage.md)\>

---

### fetchSeedRecords()?

> `optional` **fetchSeedRecords**(`ctx`, `cursor`, `limit`): `Promise`\<[`SeedRecordPage`](SeedRecordPage.md)\>

Fetch a page of pre-computed read model records for initial seeding.
This is the primary seeding mechanism — records go directly into the
read model store without event processing.

If undefined, falls back to fetchSeedEvents (event-based seeding).
If neither is defined, seeding is skipped for this collection.

#### Parameters

##### ctx

[`FetchContext`](FetchContext.md)

##### cursor

`string` | `null`

##### limit

`number`

#### Returns

`Promise`\<[`SeedRecordPage`](SeedRecordPage.md)\>

---

### fetchStreamEvents()?

> `optional` **fetchStreamEvents**(`ctx`, `streamId`, `afterRevision`): `Promise`\<[`IPersistedEvent`](../type-aliases/IPersistedEvent.md)[]\>

Fetch per-stream events for gap recovery and command response processing.
If undefined, gap recovery processes buffered events as-is (lossy).

#### Parameters

##### ctx

[`FetchContext`](FetchContext.md)

##### streamId

`string`

##### afterRevision

`bigint`

#### Returns

`Promise`\<[`IPersistedEvent`](../type-aliases/IPersistedEvent.md)[]\>

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
