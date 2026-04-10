[**@cqrs-toolkit/client-solid**](../README.md)

---

[@cqrs-toolkit/client-solid](../globals.md) / createEntityCacheKey

# Function: createEntityCacheKey()

> **createEntityCacheKey**\<`TLink`\>(`linkTemplate`, `id`, `parentKey?`): () => `EntityCacheKey`\<`TLink`\> \| `undefined`

Create a reactive entity cache key that registers with the CacheManager.

Uses the CqrsClient from context. Returns `undefined` when the id accessor
returns `undefined`. Automatically updates when IDs are reconciled.

## Type Parameters

### TLink

`TLink` _extends_ `Link`\<`string`, `string`\>

## Parameters

### linkTemplate

`Omit`\<`TLink`, `"id"`\>

Link fields without `id` (e.g., `{ service: 'nb', type: 'Notebook' }`)

### id

() => `EntityId` \| `undefined`

Reactive accessor returning the entity ID or undefined

### parentKey?

`string`

Optional parent cache key for hierarchical eviction

## Returns

Accessor returning the registered entity cache key, or undefined

> (): `EntityCacheKey`\<`TLink`\> \| `undefined`

### Returns

`EntityCacheKey`\<`TLink`\> \| `undefined`
