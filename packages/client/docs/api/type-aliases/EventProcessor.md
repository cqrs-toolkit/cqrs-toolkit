[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / EventProcessor

# Type Alias: EventProcessor()\<TEvent, TModel\>

> **EventProcessor**\<`TEvent`, `TModel`\> = (`event`, `context`) => [`ProcessorReturn`](ProcessorReturn.md)\<`TModel`\> \| `Promise`\<[`ProcessorReturn`](ProcessorReturn.md)\<`TModel`\>\>

Defined in: [packages/client/src/core/event-processor/types.ts:51](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/event-processor/types.ts#L51)

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
