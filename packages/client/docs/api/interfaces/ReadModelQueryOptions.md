[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / ReadModelQueryOptions

# Interface: ReadModelQueryOptions

Query options for listing read models.

## Extends

- [`QueryOptions`](QueryOptions.md)

## Extended by

- [`QueryManagerQueryOptions`](QueryManagerQueryOptions.md)

## Properties

### cacheKey?

> `optional` **cacheKey**: `string`

Filter by cache key

---

### limit?

> `optional` **limit**: `number`

#### Inherited from

[`QueryOptions`](QueryOptions.md).[`limit`](QueryOptions.md#limit)

---

### localChangesOnly?

> `optional` **localChangesOnly**: `boolean`

Only include models with local changes

---

### offset?

> `optional` **offset**: `number`

#### Inherited from

[`QueryOptions`](QueryOptions.md).[`offset`](QueryOptions.md#offset)

---

### orderBy?

> `optional` **orderBy**: `string`

#### Inherited from

[`QueryOptions`](QueryOptions.md).[`orderBy`](QueryOptions.md#orderby)

---

### orderDirection?

> `optional` **orderDirection**: `"asc"` \| `"desc"`

#### Inherited from

[`QueryOptions`](QueryOptions.md).[`orderDirection`](QueryOptions.md#orderdirection)
