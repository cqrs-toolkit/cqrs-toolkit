[**@cqrs-toolkit/client**](../README.md)

***

[@cqrs-toolkit/client](../globals.md) / ParsedEvent

# Interface: ParsedEvent

Defined in: packages/client/src/core/event-processor/EventProcessorRunner.ts:25

Parsed event for processing.

## Properties

### cacheKey

> **cacheKey**: `string`

Defined in: packages/client/src/core/event-processor/EventProcessorRunner.ts:33

***

### commandId?

> `optional` **commandId**: `string`

Defined in: packages/client/src/core/event-processor/EventProcessorRunner.ts:31

***

### data

> **data**: `unknown`

Defined in: packages/client/src/core/event-processor/EventProcessorRunner.ts:30

***

### id

> **id**: `string`

Defined in: packages/client/src/core/event-processor/EventProcessorRunner.ts:26

***

### persistence

> **persistence**: [`EventPersistence`](../type-aliases/EventPersistence.md)

Defined in: packages/client/src/core/event-processor/EventProcessorRunner.ts:29

***

### revision?

> `optional` **revision**: `string`

Defined in: packages/client/src/core/event-processor/EventProcessorRunner.ts:32

***

### streamId

> **streamId**: `string`

Defined in: packages/client/src/core/event-processor/EventProcessorRunner.ts:28

***

### type

> **type**: `string`

Defined in: packages/client/src/core/event-processor/EventProcessorRunner.ts:27
