[**@cqrs-toolkit/client-solid**](../README.md)

---

[@cqrs-toolkit/client-solid](../globals.md) / createItemQuery

# Function: createItemQuery()

> **createItemQuery**\<`T`\>(`queryManager`, `collection`, `id`, `options?`): [`ItemQueryState`](../interfaces/ItemQueryState.md)\<`T`\>

Create a reactive single-item query that subscribes to collection changes.

Fetches the item immediately, subscribes to `watchCollection` filtered
by the target ID, and refetches on matching updates.
The `id` parameter is an accessor, so it re-subscribes when the ID changes
(e.g., route param changes).

## Type Parameters

### T

`T` _extends_ [`Identifiable`](../interfaces/Identifiable.md)

## Parameters

### queryManager

`IQueryManager`

The query manager

### collection

`string`

Collection name

### id

() => `string`

Accessor returning the entity ID (reactive)

### options?

[`ItemQueryOptions`](../interfaces/ItemQueryOptions.md)

Query options (scope)

## Returns

[`ItemQueryState`](../interfaces/ItemQueryState.md)\<`T`\>

Reactive store with data, loading, hasLocalChanges, error
