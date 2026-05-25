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

### filter?

> `optional` **filter**: [`ListFilter`](ListFilter.md) \| [`PreEvaluatedListFilter`](PreEvaluatedListFilter.md)

Per-call filter. The library ANDs the user fragment onto its own
cache-key clause; see [ListFilter](ListFilter.md) for the wrapping contract.

`ListFilter` is the form consumers author. `PreEvaluatedListFilter`
appears on the worker side after the proxy serializes the user
fragment for transport.

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

---

### sort?

> `optional` **sort**: [`Sort`](../type-aliases/Sort.md)

Per-call sort override. When omitted, falls back to
`Collection.list.defaultSort` if set, otherwise the storage backend's
natural order.

---

### windowId?

> `optional` **windowId**: `string`

**`Internal`**

Window ID for hold tracking. Injected by the facade/proxy.

#### Inherited from

[`QueryOptions`](QueryOptions.md).[`windowId`](QueryOptions.md#windowid)
