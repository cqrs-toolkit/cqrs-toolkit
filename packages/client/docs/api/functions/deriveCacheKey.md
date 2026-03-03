[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../README.md) / deriveCacheKey

# Function: deriveCacheKey()

> **deriveCacheKey**(`collection`, `params?`): `string`

Defined in: packages/client/src/utils/uuid.ts:38

Derive a cache key from collection and query parameters.

## Parameters

### collection

`string`

Collection name

### params?

`Record`\<`string`, `unknown`\>

Query parameters

## Returns

`string`

Deterministic cache key
