[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / CacheKeyTemplate

# Type Alias: CacheKeyTemplate\<TLink\>

> **CacheKeyTemplate**\<`TLink`\> = [`EntityCacheKeyTemplate`](../interfaces/EntityCacheKeyTemplate.md)\<`TLink`\> \| [`ScopeCacheKeyTemplate`](../interfaces/ScopeCacheKeyTemplate.md)

Discriminated union of cache key templates.
Input to `registerCacheKey` — the system assigns a stable opaque UUID.

## Type Parameters

### TLink

`TLink` _extends_ `Link`
