[**@cqrs-toolkit/client**](../../../../README.md)

---

[@cqrs-toolkit/client](../../../../globals.md) / [testing](../README.md) / deriveEntityKey

# Function: deriveEntityKey()

> **deriveEntityKey**\<`TLink`\>(`link`, `parentKey?`): [`EntityCacheKey`](../../../../interfaces/EntityCacheKey.md)\<`TLink`\>

Derive a deterministic entity cache key for tests.
Uses UUID v5 derivation — only for tests, not production code.
Production code should use `registerCacheKey` on the CacheManager.

## Type Parameters

### TLink

`TLink` _extends_ `Link`\<`string`, `string`\>

## Parameters

### link

`TLink`

### parentKey?

`string`

## Returns

[`EntityCacheKey`](../../../../interfaces/EntityCacheKey.md)\<`TLink`\>
