[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / SharedWorkerAdapterConfig

# Interface: SharedWorkerAdapterConfig

Defined in: packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts:40

Configuration for SharedWorkerAdapter.

## Properties

### heartbeatInterval?

> `optional` **heartbeatInterval**: `number`

Defined in: packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts:48

Heartbeat interval in milliseconds (default: 10000)

---

### requestTimeout?

> `optional` **requestTimeout**: `number`

Defined in: packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts:46

Request timeout in milliseconds (default: 30000)

---

### sqliteWorkerUrl

> **sqliteWorkerUrl**: `string`

Defined in: packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts:44

Per-tab SQLite DedicatedWorker URL for Mode C

---

### workerUrl

> **workerUrl**: `string`

Defined in: packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts:42

URL to the consumer's SharedWorker script
