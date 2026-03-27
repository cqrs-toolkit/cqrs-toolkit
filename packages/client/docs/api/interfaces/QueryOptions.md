[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / QueryOptions

# Interface: QueryOptions\<TLink\>

Common query parameters shared by all query methods.

## Extended by

- [`GetByIdParams`](GetByIdParams.md)
- [`GetByIdsParams`](GetByIdsParams.md)
- [`ListParams`](ListParams.md)

## Type Parameters

### TLink

`TLink` _extends_ `Link`

## Properties

### cacheKey

> **cacheKey**: [`CacheKeyIdentity`](../type-aliases/CacheKeyIdentity.md)\<`TLink`\>

Cache key identity — determines which cached data scope to query

---

### collection

> **collection**: `string`

Collection name

---

### hold?

> `optional` **hold**: `boolean`

Place a hold on the cache key while query is active
