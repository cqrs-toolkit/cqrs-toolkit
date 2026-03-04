[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / ParsedEvent

# Interface: ParsedEvent

Defined in: packages/client/src/core/event-processor/EventProcessorRunner.ts:30

Parsed event for processing.

## Properties

### cacheKey

> **cacheKey**: `string`

Defined in: packages/client/src/core/event-processor/EventProcessorRunner.ts:39

---

### commandId?

> `optional` **commandId**: `string`

Defined in: packages/client/src/core/event-processor/EventProcessorRunner.ts:36

---

### data

> **data**: `unknown`

Defined in: packages/client/src/core/event-processor/EventProcessorRunner.ts:35

---

### id

> **id**: `string`

Defined in: packages/client/src/core/event-processor/EventProcessorRunner.ts:31

---

### persistence

> **persistence**: [`EventPersistence`](../type-aliases/EventPersistence.md)

Defined in: packages/client/src/core/event-processor/EventProcessorRunner.ts:34

---

### position?

> `optional` **position**: `bigint`

Defined in: packages/client/src/core/event-processor/EventProcessorRunner.ts:38

---

### revision?

> `optional` **revision**: `bigint`

Defined in: packages/client/src/core/event-processor/EventProcessorRunner.ts:37

---

### streamId

> **streamId**: `string`

Defined in: packages/client/src/core/event-processor/EventProcessorRunner.ts:33

---

### type

> **type**: `string`

Defined in: packages/client/src/core/event-processor/EventProcessorRunner.ts:32
