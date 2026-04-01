[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / QueryManagerConfig

# Interface: QueryManagerConfig\<TLink, TCommand\>

Query manager configuration.

## Type Parameters

### TLink

`TLink` _extends_ `Link`

### TCommand

`TCommand` _extends_ [`EnqueueCommand`](EnqueueCommand.md)

## Properties

### cacheManager

> **cacheManager**: [`CacheManager`](../classes/CacheManager.md)\<`TLink`, `TCommand`\>

---

### eventBus

> **eventBus**: [`EventBus`](../classes/EventBus.md)\<`TLink`\>

---

### readModelStore

> **readModelStore**: [`ReadModelStore`](../classes/ReadModelStore.md)\<`TLink`, `TCommand`\>
