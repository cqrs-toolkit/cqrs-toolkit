[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / startSharedWorker

# Function: startSharedWorker()

> **startSharedWorker**\<`TLink`, `TSchema`, `TEvent`\>(`config`): `void`

Bootstrap a SharedWorker with CQRS orchestration.

Creates the message handler, orchestrator, and coordinator logic for
managing per-tab SQLite workers and active tab routing.

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

Shared CQRS config (same object the main thread uses)

## Returns

`void`
