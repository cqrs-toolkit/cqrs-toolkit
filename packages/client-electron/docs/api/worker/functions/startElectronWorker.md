[**@cqrs-toolkit/client-electron**](../../README.md)

---

[@cqrs-toolkit/client-electron](../../modules.md) / [worker](../README.md) / startElectronWorker

# Function: startElectronWorker()

> **startElectronWorker**\<`TLink`, `TCommand`, `TSchema`, `TEvent`\>(`config`): `void`

Bootstrap an Electron utility process with CQRS orchestration.

Listens on `process.parentPort` for the init message from the main
process bridge, then creates the full component stack.

## Type Parameters

### TLink

`TLink` _extends_ `Link`\<`string`, `string`\>

### TCommand

`TCommand` _extends_ `EnqueueCommand`\<`unknown`\>

### TSchema

`TSchema`

### TEvent

`TEvent` _extends_ `IAnticipatedEvent`\<`string`, `AggregateEventData`\>

## Parameters

### config

`CqrsConfig`\<`TLink`, `TCommand`, `TSchema`, `TEvent`\>

Shared CQRS config (same object the renderer uses)

## Returns

`void`
