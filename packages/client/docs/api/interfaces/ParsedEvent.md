[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / ParsedEvent

# Interface: ParsedEvent

Defined in: [packages/client/src/core/event-processor/EventProcessorRunner.ts:30](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/event-processor/EventProcessorRunner.ts#L30)

Parsed event for processing.

## Properties

### cacheKey

> **cacheKey**: `string`

Defined in: [packages/client/src/core/event-processor/EventProcessorRunner.ts:39](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/event-processor/EventProcessorRunner.ts#L39)

---

### commandId?

> `optional` **commandId**: `string`

Defined in: [packages/client/src/core/event-processor/EventProcessorRunner.ts:36](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/event-processor/EventProcessorRunner.ts#L36)

---

### data

> **data**: `unknown`

Defined in: [packages/client/src/core/event-processor/EventProcessorRunner.ts:35](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/event-processor/EventProcessorRunner.ts#L35)

---

### id

> **id**: `string`

Defined in: [packages/client/src/core/event-processor/EventProcessorRunner.ts:31](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/event-processor/EventProcessorRunner.ts#L31)

---

### persistence

> **persistence**: [`EventPersistence`](../type-aliases/EventPersistence.md)

Defined in: [packages/client/src/core/event-processor/EventProcessorRunner.ts:34](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/event-processor/EventProcessorRunner.ts#L34)

---

### position?

> `optional` **position**: `bigint`

Defined in: [packages/client/src/core/event-processor/EventProcessorRunner.ts:38](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/event-processor/EventProcessorRunner.ts#L38)

---

### revision?

> `optional` **revision**: `bigint`

Defined in: [packages/client/src/core/event-processor/EventProcessorRunner.ts:37](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/event-processor/EventProcessorRunner.ts#L37)

---

### streamId

> **streamId**: `string`

Defined in: [packages/client/src/core/event-processor/EventProcessorRunner.ts:33](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/event-processor/EventProcessorRunner.ts#L33)

---

### type

> **type**: `string`

Defined in: [packages/client/src/core/event-processor/EventProcessorRunner.ts:32](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/event-processor/EventProcessorRunner.ts#L32)
