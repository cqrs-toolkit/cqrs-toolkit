[**@cqrs-toolkit/client-solid**](../README.md)

---

[@cqrs-toolkit/client-solid](../globals.md) / createListQuery

# Function: createListQuery()

> **createListQuery**\<`TLink`, `T`\>(`queryManager`, `params`): [`ListQueryState`](../interfaces/ListQueryState.md)\<`T`\>

Create a reactive list query that subscribes to collection changes.

Fetches the collection immediately, subscribes to `watchCollection`,
and refetches on each update.
Uses `createStore` + `reconcile` for fine-grained reactivity and
stable `<For>` identity.

When an entity's ID is reconciled (client temp ID → server ID), the store
pre-mutates existing items so `reconcile()` preserves Solid store identity.
The `reconciled` field exposes these mappings for consumers holding entity
IDs in external signals (selection state, URL params).

The `cacheKey` parameter is required. When it is a reactive accessor,
the query re-subscribes when the cache key identity changes — releasing
the old key and resetting to loading state.

## Type Parameters

### TLink

`TLink` _extends_ `Link`\<`string`, `string`\>

### T

`T` _extends_ [`Identifiable`](../interfaces/Identifiable.md)

## Parameters

### queryManager

`IQueryManager`\<`TLink`\>

The query manager (should be StableRefQueryManager-wrapped for best results)

### params

[`ListQueryParams`](../interfaces/ListQueryParams.md)\<`TLink`\>

Query parameters (collection, cacheKey, limit, offset)

## Returns

[`ListQueryState`](../interfaces/ListQueryState.md)\<`T`\>

Reactive store with items, loading, total, hasLocalChanges, state, reconciled
