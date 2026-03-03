[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../README.md) / deriveScopedCacheKey

# Function: deriveScopedCacheKey()

> **deriveScopedCacheKey**(`scope`, `collection`, `params?`): `string`

Defined in: packages/client/src/core/cache-manager/CacheKey.ts:39

Derive a scope-based cache key.
Scopes allow sub-partitioning of cache data (e.g., per-user data).

## Parameters

### scope

`string`

Scope identifier (e.g., userId)

### collection

`string`

Collection name

### params?

`Record`\<`string`, `unknown`\>

Optional query parameters

## Returns

`string`

Deterministic UUID v5 cache key
