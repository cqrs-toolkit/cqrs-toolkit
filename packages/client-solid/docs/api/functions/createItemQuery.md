[**@cqrs-toolkit/client-solid**](../README.md)

---

[@cqrs-toolkit/client-solid](../globals.md) / createItemQuery

# Function: createItemQuery()

> **createItemQuery**\<`TLink`, `T`\>(`queryManager`, `params`): [`ItemQueryState`](../interfaces/ItemQueryState.md)\<`T`\>

Create a reactive single-item query that subscribes to collection changes.

Fetches the item immediately, subscribes to `watchCollection` filtered
by the target ID, and refetches on matching updates.
The `id` parameter can be a string or accessor — when an accessor,
the query re-subscribes when the ID changes (e.g., route param changes).

Handles ID reconciliation transparently: if the tracked client ID was replaced
by a server-assigned ID, the query follows the new ID automatically and exposes
the mapping via `reconciledId`.

## Type Parameters

### TLink

`TLink` _extends_ `Link`\<`string`, `string`\>

### T

`T` _extends_ [`Identifiable`](../interfaces/Identifiable.md)

## Parameters

### queryManager

`IQueryManager`\<`TLink`\>

The query manager

### params

[`ItemQueryParams`](../interfaces/ItemQueryParams.md)\<`TLink`\>

Query parameters (collection, id, cacheKey)

## Returns

[`ItemQueryState`](../interfaces/ItemQueryState.md)\<`T`\>

Reactive store with data, loading, hasLocalChanges, error, reconciledId
