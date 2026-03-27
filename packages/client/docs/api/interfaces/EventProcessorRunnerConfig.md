[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / EventProcessorRunnerConfig

# Interface: EventProcessorRunnerConfig\<TLink\>

Event processor runner configuration.

## Type Parameters

### TLink

`TLink` _extends_ `Link`

## Properties

### anticipatedEventHandler?

> `optional` **anticipatedEventHandler**: `IAnticipatedEventHandler`

Anticipated event handler for create reconciliation. Optional — only needed with command handlers.

---

### eventBus

> **eventBus**: [`EventBus`](../classes/EventBus.md)\<`TLink`\>

---

### readModelStore

> **readModelStore**: [`ReadModelStore`](../classes/ReadModelStore.md)\<`TLink`\>

---

### registry

> **registry**: [`EventProcessorRegistry`](../classes/EventProcessorRegistry.md)
