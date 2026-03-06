[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / ProcessorContext

# Interface: ProcessorContext

Defined in: [packages/client/src/core/event-processor/types.ts:59](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/event-processor/types.ts#L59)

Context passed to event processors.

## Properties

### commandId?

> `optional` **commandId**: `string`

Defined in: [packages/client/src/core/event-processor/types.ts:63](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/event-processor/types.ts#L63)

For anticipated events, the command ID

---

### eventId

> **eventId**: `string`

Defined in: [packages/client/src/core/event-processor/types.ts:71](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/event-processor/types.ts#L71)

Unique event ID

---

### getCurrentState()

> **getCurrentState**: \<`T`\>(`collection`, `id`) => `Promise`\<`T` \| `undefined`\>

Defined in: [packages/client/src/core/event-processor/types.ts:73](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/event-processor/types.ts#L73)

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

---

### persistence

> **persistence**: [`EventPersistence`](../type-aliases/EventPersistence.md)

Defined in: [packages/client/src/core/event-processor/types.ts:61](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/event-processor/types.ts#L61)

Event persistence type

---

### position?

> `optional` **position**: `bigint`

Defined in: [packages/client/src/core/event-processor/types.ts:67](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/event-processor/types.ts#L67)

Global position of the event (absent for anticipated events)

---

### revision?

> `optional` **revision**: `bigint`

Defined in: [packages/client/src/core/event-processor/types.ts:65](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/event-processor/types.ts#L65)

Stream revision of the event (absent for anticipated events)

---

### streamId

> **streamId**: `string`

Defined in: [packages/client/src/core/event-processor/types.ts:69](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/event-processor/types.ts#L69)

Stream ID the event belongs to
