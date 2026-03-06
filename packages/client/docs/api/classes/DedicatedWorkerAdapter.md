[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / DedicatedWorkerAdapter

# Class: DedicatedWorkerAdapter

Defined in: [packages/client/src/adapters/dedicated-worker/DedicatedWorkerAdapter.ts:62](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/adapters/dedicated-worker/DedicatedWorkerAdapter.ts#L62)

Dedicated Worker adapter for single-tab offline support.

This adapter:

- Acquires a Web Lock to enforce single-tab operation
- Connects to a Dedicated Worker that owns all CQRS components
- Provides proxy objects for main-thread consumers

## Implements

- [`IWorkerAdapter`](../interfaces/IWorkerAdapter.md)

## Constructors

### Constructor

> **new DedicatedWorkerAdapter**(`config`): `DedicatedWorkerAdapter`

Defined in: [packages/client/src/adapters/dedicated-worker/DedicatedWorkerAdapter.ts:78](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/adapters/dedicated-worker/DedicatedWorkerAdapter.ts#L78)

#### Parameters

##### config

[`DedicatedWorkerAdapterConfig`](../interfaces/DedicatedWorkerAdapterConfig.md)

#### Returns

`DedicatedWorkerAdapter`

## Properties

### mode

> `readonly` **mode**: `"dedicated-worker"`

Defined in: [packages/client/src/adapters/dedicated-worker/DedicatedWorkerAdapter.ts:63](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/adapters/dedicated-worker/DedicatedWorkerAdapter.ts#L63)

#### Implementation of

[`IWorkerAdapter`](../interfaces/IWorkerAdapter.md).[`mode`](../interfaces/IWorkerAdapter.md#mode)

## Accessors

### cacheManager

#### Get Signature

> **get** **cacheManager**(): [`ICacheManager`](../interfaces/ICacheManager.md)

Defined in: [packages/client/src/adapters/dedicated-worker/DedicatedWorkerAdapter.ts:101](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/adapters/dedicated-worker/DedicatedWorkerAdapter.ts#L101)

##### Returns

[`ICacheManager`](../interfaces/ICacheManager.md)

#### Implementation of

[`IWorkerAdapter`](../interfaces/IWorkerAdapter.md).[`cacheManager`](../interfaces/IWorkerAdapter.md#cachemanager)

---

### commandQueue

#### Get Signature

> **get** **commandQueue**(): [`ICommandQueue`](../interfaces/ICommandQueue.md)

Defined in: [packages/client/src/adapters/dedicated-worker/DedicatedWorkerAdapter.ts:91](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/adapters/dedicated-worker/DedicatedWorkerAdapter.ts#L91)

##### Returns

[`ICommandQueue`](../interfaces/ICommandQueue.md)

#### Implementation of

[`IWorkerAdapter`](../interfaces/IWorkerAdapter.md).[`commandQueue`](../interfaces/IWorkerAdapter.md#commandqueue)

---

### events$

#### Get Signature

> **get** **events$**(): `Observable`\<[`LibraryEvent`](../interfaces/LibraryEvent.md)\<[`LibraryEventType`](../type-aliases/LibraryEventType.md)\>\>

Defined in: [packages/client/src/adapters/dedicated-worker/DedicatedWorkerAdapter.ts:86](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/adapters/dedicated-worker/DedicatedWorkerAdapter.ts#L86)

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

Defined in: [packages/client/src/adapters/dedicated-worker/DedicatedWorkerAdapter.ts:96](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/adapters/dedicated-worker/DedicatedWorkerAdapter.ts#L96)

##### Returns

[`IQueryManager`](../interfaces/IQueryManager.md)

#### Implementation of

[`IWorkerAdapter`](../interfaces/IWorkerAdapter.md).[`queryManager`](../interfaces/IWorkerAdapter.md#querymanager)

---

### status

#### Get Signature

> **get** **status**(): [`AdapterStatus`](../type-aliases/AdapterStatus.md)

Defined in: [packages/client/src/adapters/dedicated-worker/DedicatedWorkerAdapter.ts:82](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/adapters/dedicated-worker/DedicatedWorkerAdapter.ts#L82)

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

Defined in: [packages/client/src/adapters/dedicated-worker/DedicatedWorkerAdapter.ts:106](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/adapters/dedicated-worker/DedicatedWorkerAdapter.ts#L106)

##### Returns

[`CqrsClientSyncManager`](../interfaces/CqrsClientSyncManager.md)

#### Implementation of

[`IWorkerAdapter`](../interfaces/IWorkerAdapter.md).[`syncManager`](../interfaces/IWorkerAdapter.md#syncmanager)

## Methods

### close()

> **close**(): `Promise`\<`void`\>

Defined in: [packages/client/src/adapters/dedicated-worker/DedicatedWorkerAdapter.ts:196](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/adapters/dedicated-worker/DedicatedWorkerAdapter.ts#L196)

Close the adapter and release resources.

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IWorkerAdapter`](../interfaces/IWorkerAdapter.md).[`close`](../interfaces/IWorkerAdapter.md#close)

---

### initialize()

> **initialize**(): `Promise`\<`void`\>

Defined in: [packages/client/src/adapters/dedicated-worker/DedicatedWorkerAdapter.ts:118](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/adapters/dedicated-worker/DedicatedWorkerAdapter.ts#L118)

Initialize the adapter.

Acquires a Web Lock for single-tab enforcement before spawning the worker.

#### Returns

`Promise`\<`void`\>

#### Throws

TabLockError if another tab already has the lock

#### Implementation of

[`IWorkerAdapter`](../interfaces/IWorkerAdapter.md).[`initialize`](../interfaces/IWorkerAdapter.md#initialize)
