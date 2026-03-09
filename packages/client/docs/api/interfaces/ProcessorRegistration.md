[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / ProcessorRegistration

# Interface: ProcessorRegistration\<TEvent, TModel\>

Processor registration.

Uses method syntax for `processor` so that registrations with specific event/model types
are assignable to `ProcessorRegistration[]` (bivariant parameter checking).
This allows typed processors to be collected into heterogeneous arrays.

## Type Parameters

### TEvent

`TEvent` = `unknown`

### TModel

`TModel` _extends_ `object` = `Record`\<`string`, `unknown`\>

## Properties

### eventTypes

> **eventTypes**: `string` \| `string`[]

Event type(s) this processor handles

---

### persistenceTypes?

> `optional` **persistenceTypes**: [`EventPersistence`](../type-aliases/EventPersistence.md)[]

Optional: Only process certain persistence types

## Methods

### processor()

> **processor**(`event`, `context`): [`ProcessorReturn`](../type-aliases/ProcessorReturn.md)\<`TModel`\> \| `Promise`\<[`ProcessorReturn`](../type-aliases/ProcessorReturn.md)\<`TModel`\>\>

The processor function

#### Parameters

##### event

`TEvent`

##### context

[`ProcessorContext`](ProcessorContext.md)

#### Returns

[`ProcessorReturn`](../type-aliases/ProcessorReturn.md)\<`TModel`\> \| `Promise`\<[`ProcessorReturn`](../type-aliases/ProcessorReturn.md)\<`TModel`\>\>
