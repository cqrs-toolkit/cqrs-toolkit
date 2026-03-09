[**@cqrs-toolkit/client-solid**](../README.md)

---

[@cqrs-toolkit/client-solid](../README.md) / createListQuery

# Function: createListQuery()

> **createListQuery**\<`T`\>(`queryManager`, `collection`, `options?`): [`ListQueryState`](../interfaces/ListQueryState.md)\<`T`\>

Create a reactive list query that subscribes to collection changes.

Fetches the collection immediately, subscribes to `watchCollection`,
and refetches on each update.
Uses `createStore` + `reconcile` for fine-grained reactivity and
stable `<For>` identity.

## Type Parameters

### T

`T` _extends_ [`Identifiable`](../interfaces/Identifiable.md)

## Parameters

### queryManager

`IQueryManager`

The query manager (should be StableRefQueryManager-wrapped for best results)

### collection

`string`

Collection name

### options?

[`ListQueryOptions`](../interfaces/ListQueryOptions.md)

Query options (scope, limit, offset)

## Returns

[`ListQueryState`](../interfaces/ListQueryState.md)\<`T`\>

Reactive store with items, loading, total, hasLocalChanges, error
