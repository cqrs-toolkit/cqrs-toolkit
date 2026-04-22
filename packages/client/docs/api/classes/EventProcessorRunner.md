[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / EventProcessorRunner

# Class: EventProcessorRunner\<TLink, TCommand\>

Event processor runner.

## Type Parameters

### TLink

`TLink` _extends_ `Link`

### TCommand

`TCommand` _extends_ [`EnqueueCommand`](../interfaces/EnqueueCommand.md)

## Constructors

### Constructor

> **new EventProcessorRunner**\<`TLink`, `TCommand`\>(`eventBus`, `registry`, `readModelStore`, `anticipatedEventHandler?`): `EventProcessorRunner`\<`TLink`, `TCommand`\>

#### Parameters

##### eventBus

[`EventBus`](EventBus.md)\<`TLink`\>

##### registry

[`EventProcessorRegistry`](EventProcessorRegistry.md)

##### readModelStore

[`ReadModelStore`](ReadModelStore.md)\<`TLink`, `TCommand`\>

##### anticipatedEventHandler?

`IAnticipatedEventHandler`\<`TLink`, `TCommand`\>

Anticipated event handler for create reconciliation. Optional — only needed with command handlers.

#### Returns

`EventProcessorRunner`\<`TLink`, `TCommand`\>

## Methods

### setAnticipatedEventHandler()

> **setAnticipatedEventHandler**(`handler`): `void`

Set the anticipated event handler after construction (breaks circular dependency
when the handler needs the runner and the runner needs the handler).

#### Parameters

##### handler

`IAnticipatedEventHandler`\<`TLink`, `TCommand`\>

#### Returns

`void`
