[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / ProcessorRegistration

# Interface: ProcessorRegistration\<TEvent, TModel\>

Defined in: [packages/client/src/core/event-processor/types.ts:83](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/event-processor/types.ts#L83)

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

Defined in: [packages/client/src/core/event-processor/types.ts:88](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/event-processor/types.ts#L88)

Event type(s) this processor handles

---

### persistenceTypes?

> `optional` **persistenceTypes**: [`EventPersistence`](../type-aliases/EventPersistence.md)[]

Defined in: [packages/client/src/core/event-processor/types.ts:95](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/event-processor/types.ts#L95)

Optional: Only process certain persistence types

## Methods

### processor()

> **processor**(`event`, `context`): [`ProcessorReturn`](../type-aliases/ProcessorReturn.md)\<`TModel`\> \| `Promise`\<[`ProcessorReturn`](../type-aliases/ProcessorReturn.md)\<`TModel`\>\>

Defined in: [packages/client/src/core/event-processor/types.ts:90](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/event-processor/types.ts#L90)

The processor function

#### Parameters

##### event

`TEvent`

##### context

[`ProcessorContext`](ProcessorContext.md)

#### Returns

[`ProcessorReturn`](../type-aliases/ProcessorReturn.md)\<`TModel`\> \| `Promise`\<[`ProcessorReturn`](../type-aliases/ProcessorReturn.md)\<`TModel`\>\>
