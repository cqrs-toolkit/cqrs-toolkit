[**@cqrs-toolkit/hypermedia-client**](../README.md)

---

[@cqrs-toolkit/hypermedia-client](../globals.md) / createCollection

# Function: createCollection()

> **createCollection**\<`TLink`\>(`opts`): [`CreateCollectionResult`](../type-aliases/CreateCollectionResult.md)\<`TLink`\>

Build the representation-driven wiring slice of a `Collection<TLink>`.

Returns `fetchSeedEvents`, `fetchStreamEvents`, and `revisionPath`
unconditionally; `fetchSeedRecords` is wired against
`representation.collection.template` when `fetchTemplateVariables` is
provided. Without it, `SyncManager` falls back to `fetchSeedEvents`-based
seeding.

The result is intended to be spread into a consumer-owned `Collection`
literal — see the module docstring for the contributor rationale.

## Type Parameters

### TLink

`TLink` _extends_ `Link`\<`string`, `string`\>

## Parameters

### opts

[`CreateCollectionOptions`](../interfaces/CreateCollectionOptions.md)\<`TLink`\>

## Returns

[`CreateCollectionResult`](../type-aliases/CreateCollectionResult.md)\<`TLink`\>
