[**@cqrs-toolkit/client-solid**](../README.md)

---

[@cqrs-toolkit/client-solid](../globals.md) / createListQuery

# Function: createListQuery()

> **createListQuery**\<`TLink`, `T`\>(`params`): [`ListQueryState`](../interfaces/ListQueryState.md)\<`T`\>

Create a reactive list query that subscribes to collection changes.

Fetches the collection immediately, subscribes to `watchCollection`,
and refetches on each update.
Uses `createStore` + `reconcile` for fine-grained reactivity and
stable `<For>` identity.

When an entity's ID is reconciled (client temp ID → server ID), the store
pre-mutates existing items so `reconcile()` preserves Solid store identity.
The `reconciled` field exposes these mappings for consumers holding entity
IDs in external signals (selection state, URL params).

### Reactive inputs

`cacheKey`, `sort`, and `filter` all accept a reactive accessor, but
they fire on different scopes:

- **`cacheKey` change → full session restart.** Cancels the in-flight
  fetch, unsubscribes the collection watcher, releases the held cache
  key, resets the store to `loading`, then starts fresh.
- **`sort` / `filter` change → in-session refetch only.** Re-runs
  `queryManager.list` with the new params against the _same_ held cache
  key. The watcher stays attached and the key is never released, so a
  sort tweak doesn't tag along with the side effects of dropping a hold
  (WS topic resubscribe, invalidation reordering, reseed attempts on
  reacquire). Items stay visible across the refetch — `reconcile`
  replaces them when the new data arrives.

Uses the CQRS client from context (via `useClient()`).

## Type Parameters

### TLink

`TLink` _extends_ `Link`\<`string`, `string`\>

### T

`T` _extends_ [`Identifiable`](../interfaces/Identifiable.md)

## Parameters

### params

[`ListQueryParams`](../interfaces/ListQueryParams.md)\<`TLink`\>

Query parameters (collection, cacheKey, limit, offset, sort, filter)

## Returns

[`ListQueryState`](../interfaces/ListQueryState.md)\<`T`\>

Reactive store with items, loading, total, hasLocalChanges, state, reconciled
