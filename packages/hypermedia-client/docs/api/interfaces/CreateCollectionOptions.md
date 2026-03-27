[**@cqrs-toolkit/hypermedia-client**](../README.md)

---

[@cqrs-toolkit/hypermedia-client](../README.md) / CreateCollectionOptions

# Interface: CreateCollectionOptions\<TLink\>

Options for creating a collection from a representation.

## Type Parameters

### TLink

`TLink` _extends_ `Link`

## Properties

### aggregateId()?

> `optional` **aggregateId**: (`streamId`) => `string`

Extract aggregate ID from streamId for item event URL expansion.
Default: splits on first '-' (convention: 'Todo-{uuid}' → '{uuid}')

#### Parameters

##### streamId

`string`

#### Returns

`string`

---

### cacheKeysFromTopics()

> **cacheKeysFromTopics**: (`topics`) => `CacheKeyIdentity`\<`TLink`\>[]

Derive cache key identities from WS event topics. Forwarded to Collection.cacheKeysFromTopics.

Derive cache key identities from WS event topics.
Called at WS ingestion to resolve which cache keys an event belongs to.
The returned identities are attached to the event before processing —
no further topic resolution happens downstream.

#### Parameters

##### topics

readonly `string`[]

Topic strings from the WS event message

#### Returns

`CacheKeyIdentity`\<`TLink`\>[]

Cache key identities this event should be associated with

---

### matchesStream()

> **matchesStream**: (`streamId`) => `boolean`

App-specific: test whether a streamId belongs to this collection

#### Parameters

##### streamId

`string`

#### Returns

`boolean`

---

### name

> **name**: `string`

Collection name (e.g. 'todos')

---

### representation

> **representation**: [`RepresentationSurfaces`](RepresentationSurfaces.md)

Representation surface data from generated representations.ts

---

### seedOnDemand?

> `optional` **seedOnDemand**: `SeedOnDemandConfig`\<`TLink`\>

On-demand config. Forwarded to Collection.seedOnDemand

---

### seedOnInit?

> `optional` **seedOnInit**: `SeedOnInitConfig`\<`TLink`\>

Auto-seed config. Forwarded to Collection.seedOnInit
