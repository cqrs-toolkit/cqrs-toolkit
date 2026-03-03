[**@cqrs-toolkit/client**](../README.md)

***

[@cqrs-toolkit/client](../globals.md) / QueryResult

# Interface: QueryResult\<T\>

Defined in: packages/client/src/core/query-manager/QueryManager.ts:36

Query result with metadata.

## Type Parameters

### T

`T`

## Properties

### cacheKey

> **cacheKey**: `string`

Defined in: packages/client/src/core/query-manager/QueryManager.ts:42

Cache key used for this query

***

### data

> **data**: `T` \| `undefined`

Defined in: packages/client/src/core/query-manager/QueryManager.ts:38

The data, or undefined if not found

***

### hasLocalChanges

> **hasLocalChanges**: `boolean`

Defined in: packages/client/src/core/query-manager/QueryManager.ts:40

Whether the data has local changes pending sync
