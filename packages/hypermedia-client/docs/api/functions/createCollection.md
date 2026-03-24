[**@cqrs-toolkit/hypermedia-client**](../README.md)

---

[@cqrs-toolkit/hypermedia-client](../README.md) / createCollection

# Function: createCollection()

> **createCollection**(`opts`): `Collection`

Create a `Collection` from representation surface data.

The returned collection has `fetchSeedEvents` and `fetchStreamEvents`
pre-wired using the representation's aggregate events and item events URLs.

## Parameters

### opts

[`CreateCollectionOptions`](../interfaces/CreateCollectionOptions.md)

## Returns

`Collection`
