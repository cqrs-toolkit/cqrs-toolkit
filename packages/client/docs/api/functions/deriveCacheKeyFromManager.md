[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / deriveCacheKeyFromManager

# Function: deriveCacheKeyFromManager()

> **deriveCacheKeyFromManager**(`collection`, `params?`): `string`

Defined in: [packages/client/src/core/cache-manager/CacheKey.ts:21](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/cache-manager/CacheKey.ts#L21)

Derive a deterministic cache key from collection and query parameters.

## Parameters

### collection

`string`

Collection name

### params?

`Record`\<`string`, `unknown`\>

Optional query parameters

## Returns

`string`

Deterministic UUID v5 cache key
