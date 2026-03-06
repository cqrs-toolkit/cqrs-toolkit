[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / deriveScopedCacheKey

# Function: deriveScopedCacheKey()

> **deriveScopedCacheKey**(`scope`, `collection`, `params?`): `string`

Defined in: [packages/client/src/core/cache-manager/CacheKey.ts:39](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/cache-manager/CacheKey.ts#L39)

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
