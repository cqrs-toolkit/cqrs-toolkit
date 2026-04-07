[**@cqrs-toolkit/client-electron**](../../README.md)

---

[@cqrs-toolkit/client-electron](../../modules.md) / [index](../README.md) / createElectronClient

# Function: createElectronClient()

> **createElectronClient**\<`TLink`, `TCommand`\>(`config?`): `Promise`\<`CqrsClient`\<`TLink`, `TCommand`\>\>

Create a CQRS client for an Electron renderer process.

If no `port` is provided, waits for the preload bridge to deliver one
via `window.postMessage`. Returns a fully initialized `CqrsClient`
using the same proxy-based interface as the browser worker modes.

## Type Parameters

### TLink

`TLink` _extends_ `Link`\<`string`, `string`\>

### TCommand

`TCommand` _extends_ `EnqueueCommand`\<`unknown`\>

## Parameters

### config?

[`CreateElectronClientConfig`](../interfaces/CreateElectronClientConfig.md) = `{}`

Client configuration (all fields optional)

## Returns

`Promise`\<`CqrsClient`\<`TLink`, `TCommand`\>\>

A fully initialized CQRS client
