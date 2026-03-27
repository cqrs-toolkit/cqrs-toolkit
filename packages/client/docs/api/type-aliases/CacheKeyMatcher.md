[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / CacheKeyMatcher

# Type Alias: CacheKeyMatcher\<TLink\>

> **CacheKeyMatcher**\<`TLink`\> = [`EntityKeyMatcher`](../interfaces/EntityKeyMatcher.md)\<`TLink`\> \| [`ScopeKeyMatcher`](../interfaces/ScopeKeyMatcher.md)

Discriminated union of cache key matchers.
Used by Collection.keyTypes to declare which cache key shapes activate a collection.

## Type Parameters

### TLink

`TLink` _extends_ `Link`
