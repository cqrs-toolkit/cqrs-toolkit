[**@cqrs-toolkit/client**](../README.md)

***

[@cqrs-toolkit/client](../globals.md) / QueryResult

# Interface: QueryResult\<T\>

Defined in: packages/client/src/core/query-manager/QueryManager.ts:43

Query result with metadata.

## Type Parameters

### T

`T`

## Properties

### cacheKey

> **cacheKey**: `string`

Defined in: packages/client/src/core/query-manager/QueryManager.ts:49

Cache key used for this query

***

### data

> **data**: `T` \| `null`

Defined in: packages/client/src/core/query-manager/QueryManager.ts:45

The data, or null if not found

***

### hasLocalChanges

> **hasLocalChanges**: `boolean`

Defined in: packages/client/src/core/query-manager/QueryManager.ts:47

Whether the data has local changes pending sync
