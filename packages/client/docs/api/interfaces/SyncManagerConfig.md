[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / SyncManagerConfig

# Interface: SyncManagerConfig\<TLink, TSchema, TEvent\>

Sync manager configuration.

## Type Parameters

### TLink

`TLink` _extends_ `Link`

### TSchema

`TSchema`

### TEvent

`TEvent` _extends_ [`IAnticipatedEvent`](IAnticipatedEvent.md)

## Properties

### auth

> **auth**: [`AuthStrategy`](AuthStrategy.md)

---

### cacheManager

> **cacheManager**: [`CacheManager`](../classes/CacheManager.md)\<`TLink`\>

---

### collections

> **collections**: [`Collection`](Collection.md)\<`TLink`\>[]

---

### commandQueue

> **commandQueue**: [`CommandQueue`](../classes/CommandQueue.md)\<`TLink`, `TSchema`, `TEvent`\>

---

### eventBus

> **eventBus**: [`EventBus`](../classes/EventBus.md)

---

### eventCache

> **eventCache**: [`EventCache`](../classes/EventCache.md)

---

### eventProcessor

> **eventProcessor**: [`EventProcessorRunner`](../classes/EventProcessorRunner.md)

---

### networkConfig

> **networkConfig**: [`NetworkConfig`](NetworkConfig.md)

---

### queryManager

> **queryManager**: [`QueryManager`](../classes/QueryManager.md)\<`TLink`\>

---

### readModelStore

> **readModelStore**: [`ReadModelStore`](../classes/ReadModelStore.md)

---

### sessionManager

> **sessionManager**: [`SessionManager`](../classes/SessionManager.md)
