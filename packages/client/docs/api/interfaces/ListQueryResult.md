[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / ListQueryResult

# Interface: ListQueryResult\<T\>

List query result.

## Type Parameters

### T

`T`

## Properties

### cacheKey

> **cacheKey**: `string`

Cache key used for this query

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
