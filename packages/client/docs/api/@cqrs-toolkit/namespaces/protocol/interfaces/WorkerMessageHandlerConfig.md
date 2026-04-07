[**@cqrs-toolkit/client**](../../../../README.md)

---

[@cqrs-toolkit/client](../../../../globals.md) / [protocol](../README.md) / WorkerMessageHandlerConfig

# Interface: WorkerMessageHandlerConfig

Configuration for [WorkerMessageHandler](../classes/WorkerMessageHandler.md).

## Extends

- [`MessageChannelConfig`](MessageChannelConfig.md)

## Properties

### requestTimeout?

> `optional` **requestTimeout**: `number`

Request timeout in milliseconds

#### Inherited from

[`MessageChannelConfig`](MessageChannelConfig.md).[`requestTimeout`](MessageChannelConfig.md#requesttimeout)

---

### responseTarget?

> `optional` **responseTarget**: [`MessageTarget`](MessageTarget.md)

Custom response target for sending messages back to the main thread.
Defaults to `globalThis.postMessage` (Web Worker context).
For Electron utility processes, pass the MessagePort connected to the renderer.

---

### serializeMessages?

> `optional` **serializeMessages**: `boolean`

Whether to serialize messages (default: true)

#### Inherited from

[`MessageChannelConfig`](MessageChannelConfig.md).[`serializeMessages`](MessageChannelConfig.md#serializemessages)
