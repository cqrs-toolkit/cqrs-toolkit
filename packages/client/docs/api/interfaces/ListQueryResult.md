[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / ListQueryResult

# Interface: ListQueryResult\<T\>

Defined in: packages/client/src/core/query-manager/types.ts:33

List query result.

## Type Parameters

### T

`T`

## Properties

### cacheKey

> **cacheKey**: `string`

Defined in: packages/client/src/core/query-manager/types.ts:41

Cache key used for this query

---

### data

> **data**: `T`[]

Defined in: packages/client/src/core/query-manager/types.ts:35

The data items

---

### hasLocalChanges

> **hasLocalChanges**: `boolean`

Defined in: packages/client/src/core/query-manager/types.ts:39

Whether any items have local changes

---

### total

> **total**: `number`

Defined in: packages/client/src/core/query-manager/types.ts:37

Total count (may differ from data.length with pagination)
