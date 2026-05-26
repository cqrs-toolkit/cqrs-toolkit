[**@cqrs-toolkit/hypermedia-client**](../README.md)

---

[@cqrs-toolkit/hypermedia-client](../globals.md) / CreateCollectionResult

# Type Alias: CreateCollectionResult\<TLink\>

> **CreateCollectionResult**\<`TLink`\> = `Pick`\<`Collection`\<`TLink`\>, `"revisionPath"` \| `"fetchSeedEvents"` \| `"fetchStreamEvents"` \| `"fetchSeedRecords"`\>

The slice of `Collection<TLink>` that [createCollection](../functions/createCollection.md) contributes:
`revisionPath` plus the three representation-derived fetch functions.
Consumers spread this into their own `Collection` literal.

## Type Parameters

### TLink

`TLink` _extends_ `Link`
