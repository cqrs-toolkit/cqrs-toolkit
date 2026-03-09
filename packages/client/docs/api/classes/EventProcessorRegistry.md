[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / EventProcessorRegistry

# Class: EventProcessorRegistry

Event processor registry.

## Constructors

### Constructor

> **new EventProcessorRegistry**(): `EventProcessorRegistry`

#### Returns

`EventProcessorRegistry`

## Methods

### clear()

> **clear**(): `void`

Clear all registrations.

#### Returns

`void`

---

### getEventTypes()

> **getEventTypes**(): `Set`\<`string`\>

Get all registered event types.

#### Returns

`Set`\<`string`\>

Set of event types

---

### getProcessors()

> **getProcessors**(`eventType`, `persistence`): [`EventProcessor`](../type-aliases/EventProcessor.md)[]

Get processors for an event type and persistence.

#### Parameters

##### eventType

`string`

Event type

##### persistence

[`EventPersistence`](../type-aliases/EventPersistence.md)

Event persistence type

#### Returns

[`EventProcessor`](../type-aliases/EventProcessor.md)[]

Matching processors

---

### hasProcessors()

> **hasProcessors**(`eventType`): `boolean`

Check if there are any processors for an event type.

#### Parameters

##### eventType

`string`

Event type

#### Returns

`boolean`

Whether there are processors

---

### register()

> **register**\<`TEvent`, `TModel`\>(`registration`): `void`

Register an event processor.

#### Type Parameters

##### TEvent

`TEvent` = `unknown`

##### TModel

`TModel` _extends_ `object` = `Record`\<`string`, `unknown`\>

#### Parameters

##### registration

[`ProcessorRegistration`](../interfaces/ProcessorRegistration.md)\<`TEvent`, `TModel`\>

Processor registration

#### Returns

`void`
