[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / QueryResult

# Interface: QueryResult\<TLink, T\>

Query result with metadata.

Parameterized on `TLink` so multi-service apps get typed cache key identities.

## Type Parameters

### TLink

`TLink` _extends_ `Link`

### T

`T`

## Properties

### cacheKey

> **cacheKey**: [`CacheKeyIdentity`](../type-aliases/CacheKeyIdentity.md)\<`TLink`\>

Cache key identity used for this query

---

### data

> **data**: `T` \| `undefined`

The data, or undefined if not found

---

### hasLocalChanges

> **hasLocalChanges**: `boolean`

Whether the data has local changes pending sync

---

### meta

> **meta**: [`ItemMeta`](ItemMeta.md) \| `undefined`

Identity metadata for change detection, undefined when data is undefined
