[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / EventProcessorRunnerConfig

# Interface: EventProcessorRunnerConfig

Event processor runner configuration.

## Properties

### anticipatedEventHandler?

> `optional` **anticipatedEventHandler**: `IAnticipatedEventHandler`

Anticipated event handler for create reconciliation. Optional — only needed with command handlers.

---

### eventBus

> **eventBus**: [`EventBus`](../classes/EventBus.md)

---

### readModelStore

> **readModelStore**: [`ReadModelStore`](../classes/ReadModelStore.md)

---

### registry

> **registry**: [`EventProcessorRegistry`](../classes/EventProcessorRegistry.md)
