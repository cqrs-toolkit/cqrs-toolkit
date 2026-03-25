[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / CacheKeyIdentity

# Type Alias: CacheKeyIdentity\<TLink\>

> **CacheKeyIdentity**\<`TLink`\> = [`EntityCacheKey`](../interfaces/EntityCacheKey.md)\<`TLink`\> \| [`ScopeCacheKey`](../interfaces/ScopeCacheKey.md)

Discriminated union of all cache key kinds.
Parameterized on TLink so multi-service apps using ServiceLink
get `service` required on entity keys.

## Type Parameters

### TLink

`TLink` _extends_ `Link`
