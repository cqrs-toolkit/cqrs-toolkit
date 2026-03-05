[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / ListQueryResult

# Interface: ListQueryResult\<T\>

Defined in: packages/client/src/core/query-manager/types.ts:45

List query result.

## Type Parameters

### T

`T`

## Properties

### cacheKey

> **cacheKey**: `string`

Defined in: packages/client/src/core/query-manager/types.ts:55

Cache key used for this query

---

### data

> **data**: `T`[]

Defined in: packages/client/src/core/query-manager/types.ts:47

The data items

---

### hasLocalChanges

> **hasLocalChanges**: `boolean`

Defined in: packages/client/src/core/query-manager/types.ts:53

Whether any items have local changes

---

### meta

> **meta**: [`ItemMeta`](ItemMeta.md)[]

Defined in: packages/client/src/core/query-manager/types.ts:49

Identity metadata parallel to data (same length and order)

---

### total

> **total**: `number`

Defined in: packages/client/src/core/query-manager/types.ts:51

Total count (may differ from data.length with pagination)
