[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / EventProcessor

# Type Alias: EventProcessor()\<TEvent, TModel\>

> **EventProcessor**\<`TEvent`, `TModel`\> = (`event`, `state`, `context`) => [`ProcessorReturn`](ProcessorReturn.md)\<`TModel`\>

Event processor function signature.
Receives the full event (with `data`, `metadata`, `type`, `streamId`) and
returns zero or more read model updates, or an invalidation signal.
May be sync or async.

`TEvent` is the full event shape — extract `event.data` for the payload,
`event.metadata` for app-domain context (e.g. ancestor ids the handler
stamped, mirroring server-side `IPersistedEvent.metadata` locations).

## Type Parameters

### TEvent

`TEvent` = `unknown`

### TModel

`TModel` _extends_ `object` = `Record`\<`string`, `unknown`\>

## Parameters

### event

`TEvent`

### state

`TModel` | `undefined`

### context

[`ProcessorContext`](../interfaces/ProcessorContext.md)

## Returns

[`ProcessorReturn`](ProcessorReturn.md)\<`TModel`\>
