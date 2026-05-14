[**@cqrs-toolkit/hypermedia-client**](../README.md)

---

[@cqrs-toolkit/hypermedia-client](../README.md) / CreateCollectionOptions

# Interface: CreateCollectionOptions\<TLink\>

Options for creating a collection from a representation.

## Type Parameters

### TLink

`TLink` _extends_ `Link`

## Properties

### aggregate

> **aggregate**: `AggregateConfig`\<`TLink`\>

Forwarded to Collection.aggregate.

---

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

> **cacheKeysFromTopics**: (`topics`) => (`CacheKeyIdentity`\<`TLink`\> \| `CacheKeyTemplate`\<`TLink`\>)[]

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

(`CacheKeyIdentity`\<`TLink`\> \| `CacheKeyTemplate`\<`TLink`\>)[]

Cache key identities or templates. Templates (no `.key`) are resolved
by the caller via `registerCacheKeySync`.

---

### idReferences?

> `readonly` `optional` **idReferences**: `IdReference`\<`TLink`\>[]

Forwarded to Collection.idReferences.

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

### revisionPath?

> `readonly` `optional` **revisionPath**: `string`

Forwarded to Collection.revisionPath. Also used by the
library-wired `fetchSeedRecords` to extract `SeedRecord.revision`
from each member.

---

### seedOnDemand?

> `optional` **seedOnDemand**: `SeedOnDemandConfig`\<`TLink`\>

On-demand config. Forwarded to Collection.seedOnDemand

---

### seedOnInit?

> `optional` **seedOnInit**: `SeedOnInitConfig`\<`TLink`\>

Auto-seed config. Forwarded to Collection.seedOnInit

## Methods

### fetchHeaders()?

> `optional` **fetchHeaders**(`cacheKey`, `ctx`): `Record`\<`string`, `string`\>

Derive extra headers from the cache key and fetch context.
Merged into the FetchContext headers for seed event and seed record fetches.
Use for context-dependent headers (e.g., x-tenant-id).

#### Parameters

##### cacheKey

`CacheKeyIdentity`\<`TLink`\>

##### ctx

`FetchContext`

#### Returns

`Record`\<`string`, `string`\>

---

### fetchTemplateVariables()?

> `optional` **fetchTemplateVariables**(`cacheKey`, `ctx`): `Record`\<`string`, `string`\>

Derive cacheKey-scoped values for the variables declared in
`representation.collection.template`.

The returned map supplies values for both path placeholders (`{var}`) and
form-style query parameters (`{?var,var,...}`); the template authoritatively
declares which entries the endpoint accepts. Missing path variables throw;
missing query variables are omitted from the URL.

Library-supplied `cursor` and `limit` are merged into the same map and
flow through the same expansion. Library values win on collision.

When present, `fetchSeedRecords` is wired against the representation's
collection surface. Without it, only `fetchSeedEvents` is wired and
`SyncManager` falls back to event-based seeding.

#### Parameters

##### cacheKey

`CacheKeyIdentity`\<`TLink`\>

##### ctx

`FetchContext`

#### Returns

`Record`\<`string`, `string`\>
