[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / QueryResult

# Interface: QueryResult\<T\>

Defined in: packages/client/src/core/query-manager/types.ts:31

Query result with metadata.

## Type Parameters

### T

`T`

## Properties

### cacheKey

> **cacheKey**: `string`

Defined in: packages/client/src/core/query-manager/types.ts:39

Cache key used for this query

---

### data

> **data**: `T` \| `undefined`

Defined in: packages/client/src/core/query-manager/types.ts:33

The data, or undefined if not found

---

### hasLocalChanges

> **hasLocalChanges**: `boolean`

Defined in: packages/client/src/core/query-manager/types.ts:37

Whether the data has local changes pending sync

---

### meta

> **meta**: [`ItemMeta`](ItemMeta.md) \| `undefined`

Defined in: packages/client/src/core/query-manager/types.ts:35

Identity metadata for change detection, undefined when data is undefined
