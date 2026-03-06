[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / deriveCacheKey

# Function: deriveCacheKey()

> **deriveCacheKey**(`collection`, `params?`): `string`

Defined in: [packages/client/src/utils/uuid.ts:38](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/utils/uuid.ts#L38)

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
