[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / matchesCacheKey

# Function: matchesCacheKey()

> **matchesCacheKey**\<`TLink`\>(`cacheKey`, `matcher`): `boolean`

Test whether a cache key identity matches a cache key matcher.
Compares the structural shape (kind + type/scopeType) without instance-specific data (id, scopeParams).

## Type Parameters

### TLink

`TLink` _extends_ `Link`\<`string`, `string`\>

## Parameters

### cacheKey

[`CacheKeyIdentity`](../type-aliases/CacheKeyIdentity.md)\<`TLink`\>

### matcher

[`CacheKeyMatcher`](../type-aliases/CacheKeyMatcher.md)\<`TLink`\>

## Returns

`boolean`
