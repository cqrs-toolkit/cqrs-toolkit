[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / startDedicatedWorker

# Function: startDedicatedWorker()

> **startDedicatedWorker**\<`TLink`, `TCommand`, `TSchema`, `TEvent`\>(`config`): `void`

Bootstrap a Dedicated Worker with CQRS orchestration.

Creates the message handler and orchestrator, registers lifecycle RPC
methods, sets up message handling, and signals readiness to the main
thread. The main thread's adapter calls `orchestrator.initialize` to
trigger component creation (includes OPFS probe for Mode B).

## Type Parameters

### TLink

`TLink` _extends_ `Link`\<`string`, `string`\>

### TCommand

`TCommand` _extends_ [`EnqueueCommand`](../interfaces/EnqueueCommand.md)\<`unknown`\>

### TSchema

`TSchema`

### TEvent

`TEvent` _extends_ [`IAnticipatedEvent`](../interfaces/IAnticipatedEvent.md)\<`string`, `AggregateEventData`\>

## Parameters

### config

[`CqrsConfig`](../interfaces/CqrsConfig.md)\<`TLink`, `TCommand`, `TSchema`, `TEvent`\>

Shared CQRS config (same object the main thread uses)

## Returns

`void`
