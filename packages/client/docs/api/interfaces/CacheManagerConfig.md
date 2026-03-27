[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / CacheManagerConfig

# Interface: CacheManagerConfig\<TLink\>

Cache manager configuration.

## Type Parameters

### TLink

`TLink` _extends_ `Link`

## Properties

### cacheConfig?

> `optional` **cacheConfig**: [`CacheConfig`](CacheConfig.md)

---

### eventBus

> **eventBus**: [`EventBus`](../classes/EventBus.md)\<`TLink`\>

---

### storage

> **storage**: [`IStorage`](IStorage.md)\<`TLink`\>

---

### windowId

> **windowId**: `string`

Unique identifier for this window/tab
