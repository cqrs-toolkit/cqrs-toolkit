[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / ProcessorContext

# Interface: ProcessorContext

Context passed to event processors.

## Properties

### commandId?

> `optional` **commandId**: `string`

For anticipated events, the command ID

---

### eventId

> **eventId**: `string`

Unique event ID

---

### getCurrentState()

> **getCurrentState**: \<`T`\>(`collection`, `id`) => `Promise`\<`T` \| `undefined`\>

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

Event persistence type

---

### position?

> `optional` **position**: `bigint`

Global position of the event (absent for anticipated events)

---

### revision?

> `optional` **revision**: `bigint`

Stream revision of the event (absent for anticipated events)

---

### streamId

> **streamId**: `string`

Stream ID the event belongs to
