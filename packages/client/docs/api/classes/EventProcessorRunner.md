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

> **new EventProcessorRunner**\<`TLink`, `TCommand`\>(`readModelStore`, `eventBus`, `registry`, `anticipatedEventHandler?`): `EventProcessorRunner`\<`TLink`, `TCommand`\>

#### Parameters

##### readModelStore

[`ReadModelStore`](ReadModelStore.md)\<`TLink`, `TCommand`\>

##### eventBus

[`EventBus`](EventBus.md)\<`TLink`\>

##### registry

[`EventProcessorRegistry`](EventProcessorRegistry.md)

##### anticipatedEventHandler?

`IAnticipatedEventHandler`

Anticipated event handler for create reconciliation. Optional — only needed with command handlers.

#### Returns

`EventProcessorRunner`\<`TLink`, `TCommand`\>

## Methods

### processEvent()

> **processEvent**(`event`): `Promise`\<[`ProcessEventResult`](../interfaces/ProcessEventResult.md)\>

Process an event and apply updates to the read model store.

#### Parameters

##### event

[`ParsedEvent`](../interfaces/ParsedEvent.md)

Parsed event to process

#### Returns

`Promise`\<[`ProcessEventResult`](../interfaces/ProcessEventResult.md)\>

IDs of updated read models and whether any processor signalled invalidation

---

### processEvents()

> **processEvents**(`events`): `Promise`\<[`ProcessEventResult`](../interfaces/ProcessEventResult.md)\>

Process multiple events in order.

#### Parameters

##### events

[`ParsedEvent`](../interfaces/ParsedEvent.md)[]

Events to process

#### Returns

`Promise`\<[`ProcessEventResult`](../interfaces/ProcessEventResult.md)\>

Aggregated result across all events

---

### setAnticipatedEventHandler()

> **setAnticipatedEventHandler**(`handler`): `void`

Set the anticipated event handler after construction (breaks circular dependency
when the handler needs the runner and the runner needs the handler).

#### Parameters

##### handler

`IAnticipatedEventHandler`

#### Returns

`void`
