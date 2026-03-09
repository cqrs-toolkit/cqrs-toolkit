[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / CqrsDevToolsHook

# Interface: CqrsDevToolsHook

Devtools hook interface.
A Chrome extension sets `window.__CQRS_TOOLKIT_DEVTOOLS__` to this shape.
The library calls `registerClient` when debug mode is enabled.

## Methods

### registerClient()

> **registerClient**(`api`): `void`

Called by the library to register a debug API instance.

#### Parameters

##### api

[`CqrsDebugAPI`](CqrsDebugAPI.md)

#### Returns

`void`
