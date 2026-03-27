[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / ListParams

# Interface: ListParams\<TLink\>

Parameters for [IQueryManager.list](IQueryManager.md#list).

## Extends

- [`QueryOptions`](QueryOptions.md)\<`TLink`\>

## Type Parameters

### TLink

`TLink` _extends_ `Link`

## Properties

### cacheKey

> **cacheKey**: [`CacheKeyIdentity`](../type-aliases/CacheKeyIdentity.md)\<`TLink`\>

Cache key identity — determines which cached data scope to query

#### Inherited from

[`QueryOptions`](QueryOptions.md).[`cacheKey`](QueryOptions.md#cachekey)

---

### collection

> **collection**: `string`

Collection name

#### Inherited from

[`QueryOptions`](QueryOptions.md).[`collection`](QueryOptions.md#collection)

---

### hold?

> `optional` **hold**: `boolean`

Place a hold on the cache key while query is active

#### Inherited from

[`QueryOptions`](QueryOptions.md).[`hold`](QueryOptions.md#hold)

---

### limit?

> `optional` **limit**: `number`

Limit number of results

---

### offset?

> `optional` **offset**: `number`

Offset for pagination
