[**@cqrs-toolkit/client-solid**](../README.md)

---

[@cqrs-toolkit/client-solid](../globals.md) / ListQueryParams

# Interface: ListQueryParams\<TLink\>

Parameters for `createListQuery`.

`cacheKey`, `sort`, and `filter` each accept either a static value or
a reactive accessor (e.g. a `createMemo`). The three react on
different scopes — see below.

When `cacheKey` resolves to `undefined`, the query enters an inactive
state (loading, no data). `sort` defaults to the collection-level
`list.defaultSort`; `filter` is a per-call predicate shipped to both
backends — see ListFilter for the wrapping contract.

### Reactive scopes

- **`cacheKey` change → full session restart.** Cancels the in-flight
  fetch, unsubscribes the collection watcher, releases the held cache
  key, resets the store to `loading`, and starts a new session.
- **`sort` / `filter` change → in-session refetch.** Re-runs
  `queryManager.list` against the _same_ held cache key. The watcher
  stays attached and the key is never released — important because
  release/reacquire has visible side effects on the cache manager
  (invalidation reordering, WS topic resubscribes, reseed attempts).
  Items stay visible across the refetch; `reconcile` replaces them
  when the new data arrives.

## Type Parameters

### TLink

`TLink` _extends_ `Link`

## Properties

### cacheKey

> **cacheKey**: `CacheKeyIdentity`\<`TLink`\> \| () => CacheKeyIdentity\<TLink\> \| undefined

---

### collection

> **collection**: `string`

---

### filter?

> `optional` **filter**: `ListFilter` \| () => `ListFilter` \| `undefined`

Static value, or a reactive accessor. Changes trigger an in-session
refetch — the cache key hold and collection watcher are preserved.

---

### limit?

> `optional` **limit**: `number`

---

### offset?

> `optional` **offset**: `number`

---

### sort?

> `optional` **sort**: `Sort` \| () => `Sort` \| `undefined`

Static value, or a reactive accessor. Changes trigger an in-session
refetch — the cache key hold and collection watcher are preserved.
