[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / QueryResult

# Interface: QueryResult\<T\>

Query result with metadata.

## Type Parameters

### T

`T`

## Properties

### cacheKey

> **cacheKey**: `string`

Cache key used for this query

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
