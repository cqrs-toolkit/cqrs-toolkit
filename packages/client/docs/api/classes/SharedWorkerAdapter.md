[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / SharedWorkerAdapter

# Class: SharedWorkerAdapter

Defined in: [packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts:70](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts#L70)

SharedWorker adapter for multi-tab offline support.

This adapter:

- Spawns a per-tab DedicatedWorker for SQLite I/O
- Connects to a SharedWorker that owns all CQRS components
- Bridges the SQLite worker to the SharedWorker via MessageChannel
- Competes for active-tab status via Web Locks
- Provides proxy objects for main-thread consumers
- Handles window registration and heartbeats
- Restores holds after worker restarts

## Implements

- [`IWorkerAdapter`](../interfaces/IWorkerAdapter.md)

## Constructors

### Constructor

> **new SharedWorkerAdapter**(`config`): `SharedWorkerAdapter`

Defined in: [packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts:94](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts#L94)

#### Parameters

##### config

[`SharedWorkerAdapterConfig`](../interfaces/SharedWorkerAdapterConfig.md)

#### Returns

`SharedWorkerAdapter`

## Properties

### mode

> `readonly` **mode**: `"shared-worker"`

Defined in: [packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts:71](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts#L71)

#### Implementation of

[`IWorkerAdapter`](../interfaces/IWorkerAdapter.md).[`mode`](../interfaces/IWorkerAdapter.md#mode)

## Accessors

### cacheManager

#### Get Signature

> **get** **cacheManager**(): [`ICacheManager`](../interfaces/ICacheManager.md)

Defined in: [packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts:118](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts#L118)

##### Returns

[`ICacheManager`](../interfaces/ICacheManager.md)

#### Implementation of

[`IWorkerAdapter`](../interfaces/IWorkerAdapter.md).[`cacheManager`](../interfaces/IWorkerAdapter.md#cachemanager)

---

### commandQueue

#### Get Signature

> **get** **commandQueue**(): [`ICommandQueue`](../interfaces/ICommandQueue.md)

Defined in: [packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts:108](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts#L108)

##### Returns

[`ICommandQueue`](../interfaces/ICommandQueue.md)

#### Implementation of

[`IWorkerAdapter`](../interfaces/IWorkerAdapter.md).[`commandQueue`](../interfaces/IWorkerAdapter.md#commandqueue)

---

### events$

#### Get Signature

> **get** **events$**(): `Observable`\<[`LibraryEvent`](../interfaces/LibraryEvent.md)\<[`LibraryEventType`](../type-aliases/LibraryEventType.md)\>\>

Defined in: [packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts:103](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts#L103)

Observable of library events.

##### Returns

`Observable`\<[`LibraryEvent`](../interfaces/LibraryEvent.md)\<[`LibraryEventType`](../type-aliases/LibraryEventType.md)\>\>

Observable of library events.

#### Implementation of

[`IWorkerAdapter`](../interfaces/IWorkerAdapter.md).[`events$`](../interfaces/IWorkerAdapter.md#events)

---

### queryManager

#### Get Signature

> **get** **queryManager**(): [`IQueryManager`](../interfaces/IQueryManager.md)

Defined in: [packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts:113](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts#L113)

##### Returns

[`IQueryManager`](../interfaces/IQueryManager.md)

#### Implementation of

[`IWorkerAdapter`](../interfaces/IWorkerAdapter.md).[`queryManager`](../interfaces/IWorkerAdapter.md#querymanager)

---

### status

#### Get Signature

> **get** **status**(): [`AdapterStatus`](../type-aliases/AdapterStatus.md)

Defined in: [packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts:99](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts#L99)

Current adapter status.

##### Returns

[`AdapterStatus`](../type-aliases/AdapterStatus.md)

Current adapter status.

#### Implementation of

[`IWorkerAdapter`](../interfaces/IWorkerAdapter.md).[`status`](../interfaces/IWorkerAdapter.md#status)

---

### syncManager

#### Get Signature

> **get** **syncManager**(): [`CqrsClientSyncManager`](../interfaces/CqrsClientSyncManager.md)

Defined in: [packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts:123](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts#L123)

##### Returns

[`CqrsClientSyncManager`](../interfaces/CqrsClientSyncManager.md)

#### Implementation of

[`IWorkerAdapter`](../interfaces/IWorkerAdapter.md).[`syncManager`](../interfaces/IWorkerAdapter.md#syncmanager)

## Methods

### close()

> **close**(): `Promise`\<`void`\>

Defined in: [packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts:250](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts#L250)

Close the adapter and release resources.

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IWorkerAdapter`](../interfaces/IWorkerAdapter.md).[`close`](../interfaces/IWorkerAdapter.md#close)

---

### initialize()

> **initialize**(): `Promise`\<`void`\>

Defined in: [packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts:133](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts#L133)

Initialize the adapter.

#### Returns

`Promise`\<`void`\>

#### Throws

OpfsUnavailableException if OPFS probe fails in the SQLite worker

#### Implementation of

[`IWorkerAdapter`](../interfaces/IWorkerAdapter.md).[`initialize`](../interfaces/IWorkerAdapter.md#initialize)
