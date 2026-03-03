[**@cqrs-toolkit/client**](../README.md)

***

[@cqrs-toolkit/client](../globals.md) / EventProcessor

# Type Alias: EventProcessor()\<TEvent, TModel\>

> **EventProcessor**\<`TEvent`, `TModel`\> = (`event`, `context`) => [`ProcessorResult`](../interfaces/ProcessorResult.md)\<`TModel`\>[] \| [`ProcessorResult`](../interfaces/ProcessorResult.md)\<`TModel`\> \| `undefined`

Defined in: packages/client/src/core/event-processor/types.ts:34

Event processor function signature.
Receives an event and returns zero or more read model updates.

## Type Parameters

### TEvent

`TEvent` = `unknown`

### TModel

`TModel` = `unknown`

## Parameters

### event

`TEvent`

### context

[`ProcessorContext`](../interfaces/ProcessorContext.md)

## Returns

[`ProcessorResult`](../interfaces/ProcessorResult.md)\<`TModel`\>[] \| [`ProcessorResult`](../interfaces/ProcessorResult.md)\<`TModel`\> \| `undefined`
