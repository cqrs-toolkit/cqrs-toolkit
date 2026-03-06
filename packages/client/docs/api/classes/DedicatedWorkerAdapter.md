[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / DedicatedWorkerAdapter

# Class: DedicatedWorkerAdapter

Defined in: [packages/client/src/adapters/dedicated-worker/DedicatedWorkerAdapter.ts:62](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/adapters/dedicated-worker/DedicatedWorkerAdapter.ts#L62)

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

Defined in: [packages/client/src/adapters/dedicated-worker/DedicatedWorkerAdapter.ts:79](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/adapters/dedicated-worker/DedicatedWorkerAdapter.ts#L79)

#### Parameters

##### config

[`DedicatedWorkerAdapterConfig`](../interfaces/DedicatedWorkerAdapterConfig.md)

#### Returns

`DedicatedWorkerAdapter`

## Properties

### mode

> `readonly` **mode**: `"dedicated-worker"`

Defined in: [packages/client/src/adapters/dedicated-worker/DedicatedWorkerAdapter.ts:63](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/adapters/dedicated-worker/DedicatedWorkerAdapter.ts#L63)

#### Implementation of

[`IWorkerAdapter`](../interfaces/IWorkerAdapter.md).[`mode`](../interfaces/IWorkerAdapter.md#mode)

---

### role

> `readonly` **role**: `"leader"`

Defined in: [packages/client/src/adapters/dedicated-worker/DedicatedWorkerAdapter.ts:64](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/adapters/dedicated-worker/DedicatedWorkerAdapter.ts#L64)

Role of this client instance.
'leader' = active writer (online-only, dedicated-worker, or active shared-worker tab).
'standby' = shared-worker tab waiting for active-tab lock.

#### Implementation of

[`IWorkerAdapter`](../interfaces/IWorkerAdapter.md).[`role`](../interfaces/IWorkerAdapter.md#role)

## Accessors

### cacheManager

#### Get Signature

> **get** **cacheManager**(): [`ICacheManager`](../interfaces/ICacheManager.md)

Defined in: [packages/client/src/adapters/dedicated-worker/DedicatedWorkerAdapter.ts:102](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/adapters/dedicated-worker/DedicatedWorkerAdapter.ts#L102)

##### Returns

[`ICacheManager`](../interfaces/ICacheManager.md)

#### Implementation of

[`IWorkerAdapter`](../interfaces/IWorkerAdapter.md).[`cacheManager`](../interfaces/IWorkerAdapter.md#cachemanager)

---

### commandQueue

#### Get Signature

> **get** **commandQueue**(): [`ICommandQueue`](../interfaces/ICommandQueue.md)

Defined in: [packages/client/src/adapters/dedicated-worker/DedicatedWorkerAdapter.ts:92](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/adapters/dedicated-worker/DedicatedWorkerAdapter.ts#L92)

##### Returns

[`ICommandQueue`](../interfaces/ICommandQueue.md)

#### Implementation of

[`IWorkerAdapter`](../interfaces/IWorkerAdapter.md).[`commandQueue`](../interfaces/IWorkerAdapter.md#commandqueue)

---

### events$

#### Get Signature

> **get** **events$**(): `Observable`\<[`LibraryEvent`](../interfaces/LibraryEvent.md)\<[`LibraryEventType`](../type-aliases/LibraryEventType.md)\>\>

Defined in: [packages/client/src/adapters/dedicated-worker/DedicatedWorkerAdapter.ts:87](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/adapters/dedicated-worker/DedicatedWorkerAdapter.ts#L87)

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

Defined in: [packages/client/src/adapters/dedicated-worker/DedicatedWorkerAdapter.ts:97](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/adapters/dedicated-worker/DedicatedWorkerAdapter.ts#L97)

##### Returns

[`IQueryManager`](../interfaces/IQueryManager.md)

#### Implementation of

[`IWorkerAdapter`](../interfaces/IWorkerAdapter.md).[`queryManager`](../interfaces/IWorkerAdapter.md#querymanager)

---

### status

#### Get Signature

> **get** **status**(): [`AdapterStatus`](../type-aliases/AdapterStatus.md)

Defined in: [packages/client/src/adapters/dedicated-worker/DedicatedWorkerAdapter.ts:83](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/adapters/dedicated-worker/DedicatedWorkerAdapter.ts#L83)

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

Defined in: [packages/client/src/adapters/dedicated-worker/DedicatedWorkerAdapter.ts:107](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/adapters/dedicated-worker/DedicatedWorkerAdapter.ts#L107)

##### Returns

[`CqrsClientSyncManager`](../interfaces/CqrsClientSyncManager.md)

#### Implementation of

[`IWorkerAdapter`](../interfaces/IWorkerAdapter.md).[`syncManager`](../interfaces/IWorkerAdapter.md#syncmanager)

## Methods

### close()

> **close**(): `Promise`\<`void`\>

Defined in: [packages/client/src/adapters/dedicated-worker/DedicatedWorkerAdapter.ts:203](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/adapters/dedicated-worker/DedicatedWorkerAdapter.ts#L203)

Close the adapter and release resources.

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IWorkerAdapter`](../interfaces/IWorkerAdapter.md).[`close`](../interfaces/IWorkerAdapter.md#close)

---

### enableDebug()

> **enableDebug**(): `Promise`\<`void`\>

Defined in: [packages/client/src/adapters/dedicated-worker/DedicatedWorkerAdapter.ts:112](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/adapters/dedicated-worker/DedicatedWorkerAdapter.ts#L112)

Enable debug mode in the worker.
Sends a `debug.enable` RPC so the worker starts emitting debug events.
One-way and idempotent — no disable path.

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IWorkerAdapter`](../interfaces/IWorkerAdapter.md).[`enableDebug`](../interfaces/IWorkerAdapter.md#enabledebug)

---

### initialize()

> **initialize**(): `Promise`\<`void`\>

Defined in: [packages/client/src/adapters/dedicated-worker/DedicatedWorkerAdapter.ts:124](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/adapters/dedicated-worker/DedicatedWorkerAdapter.ts#L124)

Initialize the adapter.

Acquires a Web Lock for single-tab enforcement before spawning the worker.

#### Returns

`Promise`\<`void`\>

#### Throws

TabLockError if another tab already has the lock

#### Implementation of

[`IWorkerAdapter`](../interfaces/IWorkerAdapter.md).[`initialize`](../interfaces/IWorkerAdapter.md#initialize)
