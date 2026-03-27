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

### orderBy?

> `optional` **orderBy**: `string`

#### Inherited from

[`IStorageQueryOptions`](IStorageQueryOptions.md).[`orderBy`](IStorageQueryOptions.md#orderby)

---

### orderDirection?

> `optional` **orderDirection**: `"asc"` \| `"desc"`

#### Inherited from

[`IStorageQueryOptions`](IStorageQueryOptions.md).[`orderDirection`](IStorageQueryOptions.md#orderdirection)
