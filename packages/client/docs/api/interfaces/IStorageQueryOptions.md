[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / IStorageQueryOptions

# Interface: IStorageQueryOptions

Query options for list operations.

## Extended by

- [`ReadModelQueryOptions`](ReadModelQueryOptions.md)

## Properties

### cacheKey?

> `optional` **cacheKey**: `string`

Restrict the result to rows associated with this cache key. When
present, the storage backend joins its cache-key bookkeeping
(junction in SQL, `cacheKeys` array in memory) and scopes the
WHERE clause accordingly. Unfiltered when omitted.

---

### filter?

> `optional` **filter**: `IStorageListFilter`

Per-call filter applied after cache-key scoping. See
IStorageListFilter.

---

### limit?

> `optional` **limit**: `number`

---

### offset?

> `optional` **offset**: `number`

---

### sort?

> `optional` **sort**: readonly `StorageSortTerm`[]

Composite ordering — earlier terms dominate; later terms break ties.
When omitted, the storage backend returns rows in its natural order
(undefined — callers must not rely on it).
