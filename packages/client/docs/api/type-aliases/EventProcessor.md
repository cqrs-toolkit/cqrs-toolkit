[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / EventProcessor

# Type Alias: EventProcessor()\<TEvent, TModel\>

> **EventProcessor**\<`TEvent`, `TModel`\> = (`event`, `context`) => [`ProcessorReturn`](ProcessorReturn.md)\<`TModel`\> \| `Promise`\<[`ProcessorReturn`](ProcessorReturn.md)\<`TModel`\>\>

Event processor function signature.
Receives an event and returns zero or more read model updates, or an invalidation signal.
May be sync or async.

## Type Parameters

### TEvent

`TEvent` = `unknown`

### TModel

`TModel` _extends_ `object` = `Record`\<`string`, `unknown`\>

## Parameters

### event

`TEvent`

### context

[`ProcessorContext`](../interfaces/ProcessorContext.md)

## Returns

[`ProcessorReturn`](ProcessorReturn.md)\<`TModel`\> \| `Promise`\<[`ProcessorReturn`](ProcessorReturn.md)\<`TModel`\>\>
