[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / SharedWorkerAdapterConfig

# Interface: SharedWorkerAdapterConfig

Defined in: [packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts:40](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts#L40)

Configuration for SharedWorkerAdapter.

## Properties

### heartbeatInterval?

> `optional` **heartbeatInterval**: `number`

Defined in: [packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts:48](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts#L48)

Heartbeat interval in milliseconds (default: 10000)

---

### requestTimeout?

> `optional` **requestTimeout**: `number`

Defined in: [packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts:46](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts#L46)

Request timeout in milliseconds (default: 30000)

---

### sqliteWorkerUrl

> **sqliteWorkerUrl**: `string`

Defined in: [packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts:44](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts#L44)

Per-tab SQLite DedicatedWorker URL for Mode C

---

### workerUrl

> **workerUrl**: `string`

Defined in: [packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts:42](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts#L42)

URL to the consumer's SharedWorker script
