[**@cqrs-toolkit/client-solid**](../README.md)

---

[@cqrs-toolkit/client-solid](../globals.md) / createScopeCacheKey

# Function: createScopeCacheKey()

> **createScopeCacheKey**\<`TLink`\>(`options`): () => `ScopeCacheKey` \| `undefined`

Create a reactive scope cache key that registers with the CacheManager.

Uses the CqrsClient from context. Always goes through `registerCacheKey`
for stable opaque UUIDs. Automatically updates when IDs are reconciled.

`entityRefPaths` is only needed for nested EntityRef values in `scopeParams`.
Top-level EntityRef values in `scopeParams` are detected automatically.

Returns `undefined` when `scopeParams` returns `undefined`.

## Type Parameters

### TLink

`TLink` _extends_ `Link`\<`string`, `string`\>

## Parameters

### options

`ScopeCacheKeyOptions`

## Returns

> (): `ScopeCacheKey` \| `undefined`

### Returns

`ScopeCacheKey` \| `undefined`
