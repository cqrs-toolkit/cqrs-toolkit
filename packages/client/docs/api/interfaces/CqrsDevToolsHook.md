[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / CqrsDevToolsHook

# Interface: CqrsDevToolsHook

Defined in: [packages/client/src/types/debug.ts:42](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/debug.ts#L42)

Devtools hook interface.
A Chrome extension sets `window.__CQRS_TOOLKIT_DEVTOOLS__` to this shape.
The library calls `registerClient` when debug mode is enabled.

## Methods

### registerClient()

> **registerClient**(`api`): `void`

Defined in: [packages/client/src/types/debug.ts:44](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/debug.ts#L44)

Called by the library to register a debug API instance.

#### Parameters

##### api

[`CqrsDebugAPI`](CqrsDebugAPI.md)

#### Returns

`void`
