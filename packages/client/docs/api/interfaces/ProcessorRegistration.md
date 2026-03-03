[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../README.md) / ProcessorRegistration

# Interface: ProcessorRegistration\<TEvent, TModel\>

Defined in: packages/client/src/core/event-processor/types.ts:54

Processor registration.

## Type Parameters

### TEvent

`TEvent` = `unknown`

### TModel

`TModel` = `unknown`

## Properties

### eventTypes

> **eventTypes**: `string` \| `string`[]

Defined in: packages/client/src/core/event-processor/types.ts:56

Event type(s) this processor handles

---

### persistenceTypes?

> `optional` **persistenceTypes**: [`EventPersistence`](../type-aliases/EventPersistence.md)[]

Defined in: packages/client/src/core/event-processor/types.ts:60

Optional: Only process certain persistence types

---

### processor

> **processor**: [`EventProcessor`](../type-aliases/EventProcessor.md)\<`TEvent`, `TModel`\>

Defined in: packages/client/src/core/event-processor/types.ts:58

The processor function
