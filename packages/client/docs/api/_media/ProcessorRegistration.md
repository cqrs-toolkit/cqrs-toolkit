[**@cqrs-toolkit/client**](../README.md)

***

[@cqrs-toolkit/client](../globals.md) / ProcessorRegistration

# Interface: ProcessorRegistration\<TEvent, TModel\>

Defined in: packages/client/src/core/event-processor/types.ts:60

Processor registration.

Uses method syntax for `processor` so that registrations with specific event/model types
are assignable to `ProcessorRegistration[]` (bivariant parameter checking).
This allows typed processors to be collected into heterogeneous arrays.

## Type Parameters

### TEvent

`TEvent` = `unknown`

### TModel

`TModel` = `unknown`

## Properties

### eventTypes

> **eventTypes**: `string` \| `string`[]

Defined in: packages/client/src/core/event-processor/types.ts:62

Event type(s) this processor handles

***

### persistenceTypes?

> `optional` **persistenceTypes**: [`EventPersistence`](../type-aliases/EventPersistence.md)[]

Defined in: packages/client/src/core/event-processor/types.ts:69

Optional: Only process certain persistence types

## Methods

### processor()

> **processor**(`event`, `context`): [`ProcessorResult`](ProcessorResult.md)\<`TModel`\> \| [`ProcessorResult`](ProcessorResult.md)\<`TModel`\>[] \| `undefined`

Defined in: packages/client/src/core/event-processor/types.ts:64

The processor function

#### Parameters

##### event

`TEvent`

##### context

[`ProcessorContext`](ProcessorContext.md)

#### Returns

[`ProcessorResult`](ProcessorResult.md)\<`TModel`\> \| [`ProcessorResult`](ProcessorResult.md)\<`TModel`\>[] \| `undefined`
