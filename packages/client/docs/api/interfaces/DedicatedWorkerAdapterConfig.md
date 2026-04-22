[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / DedicatedWorkerAdapterConfig

# Interface: DedicatedWorkerAdapterConfig

Configuration for DedicatedWorkerAdapter.

## Properties

### debug?

> `optional` **debug**: `boolean`

Whether the main-thread channel should allow `emitDebug` emissions.
Forwarded to [WorkerMessageChannel](../@cqrs-toolkit/namespaces/protocol/classes/WorkerMessageChannel.md) so local debug events
(e.g. `debug:log` from the main-thread logger) surface on
`libraryEvents$`. Has no effect on what the worker emits across
`postMessage` — that's controlled by the worker's own `EventBus.debug`
and toggled via the `debug.enable` RPC. Defaults to `false`.

---

### requestTimeout?

> `optional` **requestTimeout**: `number`

Request timeout in milliseconds (default: 30000)

---

### workerUrl

> **workerUrl**: `string`

URL to the consumer's Dedicated Worker script
