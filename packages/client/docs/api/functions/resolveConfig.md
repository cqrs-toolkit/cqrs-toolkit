[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / resolveConfig

# Function: resolveConfig()

> **resolveConfig**\<`TLink`, `TCommand`, `TSchema`, `TEvent`\>(`config`): [`ResolvedConfig`](../interfaces/ResolvedConfig.md)\<`TLink`, `TCommand`, `TSchema`, `TEvent`\>

Resolve shared configuration with defaults.

## Type Parameters

### TLink

`TLink` _extends_ `Link`\<`string`, `string`\>

### TCommand

`TCommand` _extends_ [`EnqueueCommand`](../interfaces/EnqueueCommand.md)\<`unknown`\>

### TSchema

`TSchema`

### TEvent

`TEvent` _extends_ [`IAnticipatedEvent`](../interfaces/IAnticipatedEvent.md)\<`string`, `AnticipatedAggregateEventData`\>

## Parameters

### config

[`CqrsConfig`](../interfaces/CqrsConfig.md)\<`TLink`, `TCommand`, `TSchema`, `TEvent`\>

## Returns

[`ResolvedConfig`](../interfaces/ResolvedConfig.md)\<`TLink`, `TCommand`, `TSchema`, `TEvent`\>
