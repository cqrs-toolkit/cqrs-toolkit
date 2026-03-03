[**@cqrs-toolkit/client**](../README.md)

***

[@cqrs-toolkit/client](../globals.md) / ProcessorContext

# Interface: ProcessorContext

Defined in: packages/client/src/core/event-processor/types.ts:42

Context passed to event processors.

## Properties

### commandId?

> `optional` **commandId**: `string`

Defined in: packages/client/src/core/event-processor/types.ts:46

For anticipated events, the command ID

***

### getCurrentState()

> **getCurrentState**: \<`T`\>(`collection`, `id`) => `Promise`\<`T` \| `undefined`\>

Defined in: packages/client/src/core/event-processor/types.ts:50

Get current read model state (may not exist)

#### Type Parameters

##### T

`T`

#### Parameters

##### collection

`string`

##### id

`string`

#### Returns

`Promise`\<`T` \| `undefined`\>

***

### persistence

> **persistence**: [`EventPersistence`](../type-aliases/EventPersistence.md)

Defined in: packages/client/src/core/event-processor/types.ts:44

Event persistence type

***

### revision?

> `optional` **revision**: `string`

Defined in: packages/client/src/core/event-processor/types.ts:48

Stream revision of the event (string for JSON read model compatibility). Undefined for anticipated/stateful events.
