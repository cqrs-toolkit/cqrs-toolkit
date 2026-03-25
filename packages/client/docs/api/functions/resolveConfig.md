[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / resolveConfig

# Function: resolveConfig()

> **resolveConfig**\<`TLink`, `TSchema`, `TEvent`\>(`config`): [`ResolvedConfig`](../interfaces/ResolvedConfig.md)\<`TLink`, `TSchema`, `TEvent`\>

Resolve shared configuration with defaults.

## Type Parameters

### TLink

`TLink` _extends_ `Link`\<`string`, `string`\>

### TSchema

`TSchema`

### TEvent

`TEvent` _extends_ [`IAnticipatedEvent`](../interfaces/IAnticipatedEvent.md)\<`string`, `AggregateEventData`\>

## Parameters

### config

[`CqrsConfig`](../interfaces/CqrsConfig.md)\<`TLink`, `TSchema`, `TEvent`\>

## Returns

[`ResolvedConfig`](../interfaces/ResolvedConfig.md)\<`TLink`, `TSchema`, `TEvent`\>
