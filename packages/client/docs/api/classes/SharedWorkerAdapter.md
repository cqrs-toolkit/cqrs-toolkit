[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / SharedWorkerAdapter

# Class: SharedWorkerAdapter

Defined in: [packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts:70](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts#L70)

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

Defined in: [packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts:95](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts#L95)

#### Parameters

##### config

[`SharedWorkerAdapterConfig`](../interfaces/SharedWorkerAdapterConfig.md)

#### Returns

`SharedWorkerAdapter`

## Properties

### mode

> `readonly` **mode**: `"shared-worker"`

Defined in: [packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts:71](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts#L71)

#### Implementation of

[`IWorkerAdapter`](../interfaces/IWorkerAdapter.md).[`mode`](../interfaces/IWorkerAdapter.md#mode)

## Accessors

### cacheManager

#### Get Signature

> **get** **cacheManager**(): [`ICacheManager`](../interfaces/ICacheManager.md)

Defined in: [packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts:119](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts#L119)

##### Returns

[`ICacheManager`](../interfaces/ICacheManager.md)

#### Implementation of

[`IWorkerAdapter`](../interfaces/IWorkerAdapter.md).[`cacheManager`](../interfaces/IWorkerAdapter.md#cachemanager)

---

### commandQueue

#### Get Signature

> **get** **commandQueue**(): [`ICommandQueue`](../interfaces/ICommandQueue.md)

Defined in: [packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts:109](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts#L109)

##### Returns

[`ICommandQueue`](../interfaces/ICommandQueue.md)

#### Implementation of

[`IWorkerAdapter`](../interfaces/IWorkerAdapter.md).[`commandQueue`](../interfaces/IWorkerAdapter.md#commandqueue)

---

### events$

#### Get Signature

> **get** **events$**(): `Observable`\<[`LibraryEvent`](../interfaces/LibraryEvent.md)\<[`LibraryEventType`](../type-aliases/LibraryEventType.md)\>\>

Defined in: [packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts:104](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts#L104)

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

Defined in: [packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts:114](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts#L114)

##### Returns

[`IQueryManager`](../interfaces/IQueryManager.md)

#### Implementation of

[`IWorkerAdapter`](../interfaces/IWorkerAdapter.md).[`queryManager`](../interfaces/IWorkerAdapter.md#querymanager)

---

### role

#### Get Signature

> **get** **role**(): `"leader"` \| `"standby"`

Defined in: [packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts:129](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts#L129)

Role of this client instance.
'leader' = active writer (online-only, dedicated-worker, or active shared-worker tab).
'standby' = shared-worker tab waiting for active-tab lock.

##### Returns

`"leader"` \| `"standby"`

Role of this client instance.
'leader' = active writer (online-only, dedicated-worker, or active shared-worker tab).
'standby' = shared-worker tab waiting for active-tab lock.

#### Implementation of

[`IWorkerAdapter`](../interfaces/IWorkerAdapter.md).[`role`](../interfaces/IWorkerAdapter.md#role)

---

### status

#### Get Signature

> **get** **status**(): [`AdapterStatus`](../type-aliases/AdapterStatus.md)

Defined in: [packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts:100](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts#L100)

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

Defined in: [packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts:124](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts#L124)

##### Returns

[`CqrsClientSyncManager`](../interfaces/CqrsClientSyncManager.md)

#### Implementation of

[`IWorkerAdapter`](../interfaces/IWorkerAdapter.md).[`syncManager`](../interfaces/IWorkerAdapter.md#syncmanager)

## Methods

### close()

> **close**(): `Promise`\<`void`\>

Defined in: [packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts:262](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts#L262)

Close the adapter and release resources.

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IWorkerAdapter`](../interfaces/IWorkerAdapter.md).[`close`](../interfaces/IWorkerAdapter.md#close)

---

### enableDebug()

> **enableDebug**(): `Promise`\<`void`\>

Defined in: [packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts:133](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts#L133)

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

Defined in: [packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts:143](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts#L143)

Initialize the adapter.

#### Returns

`Promise`\<`void`\>

#### Throws

OpfsUnavailableException if OPFS probe fails in the SQLite worker

#### Implementation of

[`IWorkerAdapter`](../interfaces/IWorkerAdapter.md).[`initialize`](../interfaces/IWorkerAdapter.md#initialize)
