[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / deriveCacheKeyFromManager

# Function: deriveCacheKeyFromManager()

> **deriveCacheKeyFromManager**(`collection`, `params?`): `string`

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
