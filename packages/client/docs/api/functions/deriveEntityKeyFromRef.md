[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / deriveEntityKeyFromRef

# Function: deriveEntityKeyFromRef()

> **deriveEntityKeyFromRef**\<`TLink`\>(`linkTemplate`, `id`, `parentKey?`): [`EntityCacheKey`](../interfaces/EntityCacheKey.md)\<`TLink`\>

Derive an entity cache key from a link template and an EntityId value.

Resolves the EntityId to a plain string (extracting entityId from EntityRef
if needed), then delegates to [deriveEntityKey](deriveEntityKey.md).

## Type Parameters

### TLink

`TLink` _extends_ `Link`\<`string`, `string`\>

## Parameters

### linkTemplate

`Omit`\<`TLink`, `"id"`\>

### id

[`EntityId`](../type-aliases/EntityId.md)

### parentKey?

`string`

## Returns

[`EntityCacheKey`](../interfaces/EntityCacheKey.md)\<`TLink`\>
