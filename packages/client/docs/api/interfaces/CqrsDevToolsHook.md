[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / CqrsDevToolsHook

# Interface: CqrsDevToolsHook\<TLink, TCommand, TSchema, TEvent\>

Devtools hook interface.
A Chrome extension sets `window.__CQRS_TOOLKIT_DEVTOOLS__` to this shape.
The library calls `registerClient` when debug mode is enabled.

## Type Parameters

### TLink

`TLink` _extends_ `Link`

### TCommand

`TCommand` _extends_ [`EnqueueCommand`](EnqueueCommand.md)

### TSchema

`TSchema`

### TEvent

`TEvent` _extends_ [`IAnticipatedEvent`](IAnticipatedEvent.md)

## Methods

### registerClient()

> **registerClient**(`api`): `void`

Called by the library to register a debug API instance.

#### Parameters

##### api

[`CqrsDebugAPI`](CqrsDebugAPI.md)\<`TLink`, `TCommand`, `TSchema`, `TEvent`\>

#### Returns

`void`
