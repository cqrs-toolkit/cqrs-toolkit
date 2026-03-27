[**@cqrs-toolkit/client-solid**](../README.md)

---

[@cqrs-toolkit/client-solid](../globals.md) / ItemQueryParams

# Interface: ItemQueryParams\<TLink\>

Parameters for `createItemQuery`.

`id` can be a static string or a reactive accessor.
`cacheKey` can be a static identity or a reactive accessor.

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

### id

> **id**: `string` \| () => `string`
