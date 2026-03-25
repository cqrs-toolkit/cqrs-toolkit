[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / deriveScopeKey

# Function: deriveScopeKey()

> **deriveScopeKey**(`opts`): [`ScopeCacheKey`](../interfaces/ScopeCacheKey.md)

Derive a scope cache key from scope identifiers and optional params.
Produces a deterministic UUID v5 from the scope's identifying fields.

## Parameters

### opts

#### parentKey?

`string`

#### scopeParams?

`Record`\<`string`, `unknown`\>

#### scopeType

`string`

#### service?

`string`

## Returns

[`ScopeCacheKey`](../interfaces/ScopeCacheKey.md)
