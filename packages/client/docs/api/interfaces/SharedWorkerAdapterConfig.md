[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / SharedWorkerAdapterConfig

# Interface: SharedWorkerAdapterConfig

Defined in: packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts:30

Configuration for SharedWorkerAdapter.

## Properties

### heartbeatInterval?

> `optional` **heartbeatInterval**: `number`

Defined in: packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts:38

Heartbeat interval in milliseconds (default: 10000)

---

### requestTimeout?

> `optional` **requestTimeout**: `number`

Defined in: packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts:36

Request timeout in milliseconds (default: 30000)

---

### sqliteWorkerUrl?

> `optional` **sqliteWorkerUrl**: `string`

Defined in: packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts:34

URL to the consumer's SQLite worker script (passed to worker via RPC)

---

### workerUrl

> **workerUrl**: `string`

Defined in: packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts:32

URL to the consumer's SharedWorker script
