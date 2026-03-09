[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / QueryManagerQueryOptions

# Interface: QueryManagerQueryOptions

Query options.

## Extends

- [`ReadModelQueryOptions`](ReadModelQueryOptions.md)

## Properties

### cacheKey?

> `optional` **cacheKey**: `string`

Filter by cache key

#### Inherited from

[`ReadModelQueryOptions`](ReadModelQueryOptions.md).[`cacheKey`](ReadModelQueryOptions.md#cachekey)

---

### hold?

> `optional` **hold**: `boolean`

Place a hold on the cache key while query is active

---

### limit?

> `optional` **limit**: `number`

#### Inherited from

[`ReadModelQueryOptions`](ReadModelQueryOptions.md).[`limit`](ReadModelQueryOptions.md#limit)

---

### localChangesOnly?

> `optional` **localChangesOnly**: `boolean`

Only include models with local changes

#### Inherited from

[`ReadModelQueryOptions`](ReadModelQueryOptions.md).[`localChangesOnly`](ReadModelQueryOptions.md#localchangesonly)

---

### offset?

> `optional` **offset**: `number`

#### Inherited from

[`ReadModelQueryOptions`](ReadModelQueryOptions.md).[`offset`](ReadModelQueryOptions.md#offset)

---

### orderBy?

> `optional` **orderBy**: `string`

#### Inherited from

[`ReadModelQueryOptions`](ReadModelQueryOptions.md).[`orderBy`](ReadModelQueryOptions.md#orderby)

---

### orderDirection?

> `optional` **orderDirection**: `"asc"` \| `"desc"`

#### Inherited from

[`ReadModelQueryOptions`](ReadModelQueryOptions.md).[`orderDirection`](ReadModelQueryOptions.md#orderdirection)

---

### scope?

> `optional` **scope**: `string`

Custom scope for the cache key
