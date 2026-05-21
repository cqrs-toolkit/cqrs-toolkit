[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / IStorageQueryOptions

# Interface: IStorageQueryOptions

Query options for list operations.

## Extended by

- [`ReadModelQueryOptions`](ReadModelQueryOptions.md)

## Properties

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
