[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / startSharedWorker

# Function: startSharedWorker()

> **startSharedWorker**\<`TLink`, `TCommand`, `TSchema`, `TEvent`\>(`config`): `void`

Bootstrap a SharedWorker with CQRS orchestration.

Creates the message handler, orchestrator, and coordinator logic for
managing per-tab SQLite workers and active tab routing.

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

Shared CQRS config (same object the main thread uses)

## Returns

`void`
