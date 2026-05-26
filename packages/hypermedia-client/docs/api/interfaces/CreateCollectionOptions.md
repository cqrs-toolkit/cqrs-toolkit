[**@cqrs-toolkit/hypermedia-client**](../README.md)

---

[@cqrs-toolkit/hypermedia-client](../globals.md) / CreateCollectionOptions

# Interface: CreateCollectionOptions\<TLink\>

Inputs to [createCollection](../functions/createCollection.md).

Only the fields the helper actually consumes — every other `Collection`
field is set by the consumer on its own literal.

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

### representation

> **representation**: [`RepresentationSurfaces`](RepresentationSurfaces.md)

Representation surface data from generated representations.ts

---

### revisionPath?

> `readonly` `optional` **revisionPath**: `string`

Forwarded onto the returned wiring's `revisionPath`. Used by the records
parser to extract `SeedRecord.revision` from each item, and downstream by
`AggregateChain.lastKnownRevision` advancement.

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
