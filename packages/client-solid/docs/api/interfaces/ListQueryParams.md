[**@cqrs-toolkit/client-solid**](../README.md)

---

[@cqrs-toolkit/client-solid](../globals.md) / ListQueryParams

# Interface: ListQueryParams\<TLink\>

Parameters for `createListQuery`.

`cacheKey` is required and can be either a static identity or a reactive accessor.
When the accessor returns `undefined`, the query enters an inactive state (loading, no data).

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

### limit?

> `optional` **limit**: `number`

---

### offset?

> `optional` **offset**: `number`
