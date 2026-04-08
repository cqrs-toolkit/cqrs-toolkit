[**@cqrs-toolkit/client-solid**](../README.md)

---

[@cqrs-toolkit/client-solid](../globals.md) / createScopeCacheKey

# Function: createScopeCacheKey()

> **createScopeCacheKey**(`options`): () => `ScopeCacheKey` \| `undefined`

Create a reactive scope cache key that re-derives when scope parameters change.

Wraps deriveScopeKey in a `createMemo`. When `scopeParams` is an
accessor, the memo re-runs when the params change.

Returns `undefined` when `scopeParams` returns `undefined` (if provided as an accessor).

## Parameters

### options

`ScopeCacheKeyOptions`

Scope key options with optional reactive scopeParams

## Returns

Accessor returning the derived scope cache key, or undefined

> (): `ScopeCacheKey` \| `undefined`

### Returns

`ScopeCacheKey` \| `undefined`
