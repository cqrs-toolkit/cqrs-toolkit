[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / ListQueryResult

# Interface: ListQueryResult\<TLink, T\>

List query result.

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

> **data**: `T`[]

The data items

---

### hasLocalChanges

> **hasLocalChanges**: `boolean`

Whether any items have local changes

---

### meta

> **meta**: [`ItemMeta`](ItemMeta.md)[]

Identity metadata parallel to data (same length and order)

---

### total

> **total**: `number`

Total count (may differ from data.length with pagination)
