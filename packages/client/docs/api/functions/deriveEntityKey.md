[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / deriveEntityKey

# Function: deriveEntityKey()

> **deriveEntityKey**\<`TLink`\>(`link`, `parentKey?`): [`EntityCacheKey`](../interfaces/EntityCacheKey.md)\<`TLink`\>

Derive an entity cache key from a Link.
Produces a deterministic UUID v5 from the link's identifying fields.

## Type Parameters

### TLink

`TLink` _extends_ `Link`\<`string`, `string`\>

## Parameters

### link

`TLink`

### parentKey?

`string`

## Returns

[`EntityCacheKey`](../interfaces/EntityCacheKey.md)\<`TLink`\>
