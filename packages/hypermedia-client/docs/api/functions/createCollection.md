[**@cqrs-toolkit/hypermedia-client**](../README.md)

---

[@cqrs-toolkit/hypermedia-client](../README.md) / createCollection

# Function: createCollection()

> **createCollection**\<`TLink`\>(`opts`): `Collection`\<`TLink`\>

Create a `Collection` from representation surface data.

The returned collection has `fetchSeedEvents` and `fetchStreamEvents`
pre-wired using the representation's aggregate events and item events URLs.

## Type Parameters

### TLink

`TLink` _extends_ `Link`\<`string`, `string`\>

## Parameters

### opts

[`CreateCollectionOptions`](../interfaces/CreateCollectionOptions.md)\<`TLink`\>

## Returns

`Collection`\<`TLink`\>
