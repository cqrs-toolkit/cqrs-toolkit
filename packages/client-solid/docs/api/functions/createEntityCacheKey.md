[**@cqrs-toolkit/client-solid**](../README.md)

---

[@cqrs-toolkit/client-solid](../globals.md) / createEntityCacheKey

# Function: createEntityCacheKey()

> **createEntityCacheKey**\<`TLink`\>(`linkTemplate`, `id`, `parentKey?`): () => `EntityCacheKey`\<`TLink`\> \| `undefined`

Create a reactive entity cache key that re-derives when the entity ID changes.

Wraps deriveEntityKeyFromRef in a `createMemo`. Returns `undefined`
when the id accessor returns `undefined` (e.g., no entity selected).

When a locally-created entity's ID transitions from EntityRef to string
(server confirmation), the memo re-runs and produces a new cache key derived
from the server-assigned ID. Consuming queries (e.g., `createListQuery`)
automatically re-subscribe to the new key.

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

Accessor returning the derived entity cache key, or undefined

> (): `EntityCacheKey`\<`TLink`\> \| `undefined`

### Returns

`EntityCacheKey`\<`TLink`\> \| `undefined`
