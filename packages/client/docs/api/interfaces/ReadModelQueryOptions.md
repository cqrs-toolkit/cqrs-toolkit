[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / ReadModelQueryOptions

# Interface: ReadModelQueryOptions

Query options for listing read models.

## Extends

- [`IStorageQueryOptions`](IStorageQueryOptions.md)

## Properties

### cacheKey?

> `optional` **cacheKey**: `string`

Filter by cache key

---

### limit?

> `optional` **limit**: `number`

#### Inherited from

[`IStorageQueryOptions`](IStorageQueryOptions.md).[`limit`](IStorageQueryOptions.md#limit)

---

### localChangesOnly?

> `optional` **localChangesOnly**: `boolean`

Only include models with local changes

---

### offset?

> `optional` **offset**: `number`

#### Inherited from

[`IStorageQueryOptions`](IStorageQueryOptions.md).[`offset`](IStorageQueryOptions.md#offset)

---

### sort?

> `optional` **sort**: readonly `StorageSortTerm`[]

Composite ordering — earlier terms dominate; later terms break ties.
When omitted, the storage backend returns rows in its natural order
(undefined — callers must not rely on it).

#### Inherited from

[`IStorageQueryOptions`](IStorageQueryOptions.md).[`sort`](IStorageQueryOptions.md#sort)
