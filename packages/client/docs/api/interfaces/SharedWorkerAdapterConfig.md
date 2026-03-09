[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / SharedWorkerAdapterConfig

# Interface: SharedWorkerAdapterConfig

Configuration for SharedWorkerAdapter.

## Properties

### heartbeatInterval?

> `optional` **heartbeatInterval**: `number`

Heartbeat interval in milliseconds (default: 10000)

---

### requestTimeout?

> `optional` **requestTimeout**: `number`

Request timeout in milliseconds (default: 30000)

---

### sqliteWorkerUrl

> **sqliteWorkerUrl**: `string`

Per-tab SQLite DedicatedWorker URL for Mode C

---

### workerUrl

> **workerUrl**: `string`

URL to the consumer's SharedWorker script
