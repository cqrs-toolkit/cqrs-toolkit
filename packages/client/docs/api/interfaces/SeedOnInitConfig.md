[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / SeedOnInitConfig

# Interface: SeedOnInitConfig\<TLink\>

## Type Parameters

### TLink

`TLink` _extends_ `Link`

## Properties

### cacheKey

> `readonly` **cacheKey**: [`CacheKeyIdentity`](../type-aliases/CacheKeyIdentity.md)\<`TLink`\>

Cache key identity to auto-seed on startup.

---

### topics

> `readonly` **topics**: readonly `string`[]

Web socket topics subscribed to on startup for this collection.
