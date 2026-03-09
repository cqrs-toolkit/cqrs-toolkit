[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / DedicatedWorkerAdapter

# Class: DedicatedWorkerAdapter

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

#### Parameters

##### config

[`DedicatedWorkerAdapterConfig`](../interfaces/DedicatedWorkerAdapterConfig.md)

#### Returns

`DedicatedWorkerAdapter`

## Properties

### mode

> `readonly` **mode**: `"dedicated-worker"`

#### Implementation of

[`IWorkerAdapter`](../interfaces/IWorkerAdapter.md).[`mode`](../interfaces/IWorkerAdapter.md#mode)

---

### role

> `readonly` **role**: `"leader"`

Role of this client instance.
'leader' = active writer (online-only, dedicated-worker, or active shared-worker tab).
'standby' = shared-worker tab waiting for active-tab lock.

#### Implementation of

[`IWorkerAdapter`](../interfaces/IWorkerAdapter.md).[`role`](../interfaces/IWorkerAdapter.md#role)

## Accessors

### cacheManager

#### Get Signature

> **get** **cacheManager**(): [`ICacheManager`](../interfaces/ICacheManager.md)

##### Returns

[`ICacheManager`](../interfaces/ICacheManager.md)

#### Implementation of

[`IWorkerAdapter`](../interfaces/IWorkerAdapter.md).[`cacheManager`](../interfaces/IWorkerAdapter.md#cachemanager)

---

### commandQueue

#### Get Signature

> **get** **commandQueue**(): [`ICommandQueue`](../interfaces/ICommandQueue.md)

##### Returns

[`ICommandQueue`](../interfaces/ICommandQueue.md)

#### Implementation of

[`IWorkerAdapter`](../interfaces/IWorkerAdapter.md).[`commandQueue`](../interfaces/IWorkerAdapter.md#commandqueue)

---

### events$

#### Get Signature

> **get** **events$**(): `Observable`\<[`LibraryEvent`](../interfaces/LibraryEvent.md)\<[`LibraryEventType`](../type-aliases/LibraryEventType.md)\>\>

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

##### Returns

[`IQueryManager`](../interfaces/IQueryManager.md)

#### Implementation of

[`IWorkerAdapter`](../interfaces/IWorkerAdapter.md).[`queryManager`](../interfaces/IWorkerAdapter.md#querymanager)

---

### status

#### Get Signature

> **get** **status**(): [`AdapterStatus`](../type-aliases/AdapterStatus.md)

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

##### Returns

[`CqrsClientSyncManager`](../interfaces/CqrsClientSyncManager.md)

#### Implementation of

[`IWorkerAdapter`](../interfaces/IWorkerAdapter.md).[`syncManager`](../interfaces/IWorkerAdapter.md#syncmanager)

## Methods

### close()

> **close**(): `Promise`\<`void`\>

Close the adapter and release resources.

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IWorkerAdapter`](../interfaces/IWorkerAdapter.md).[`close`](../interfaces/IWorkerAdapter.md#close)

---

### debugQuery()

> **debugQuery**\<`T`\>(`method`, `args?`): `Promise`\<`T`\>

Send an arbitrary debug RPC to the worker and return the result.
Used by devtools for raw SQL queries and other debug commands.

#### Type Parameters

##### T

`T`

#### Parameters

##### method

`string`

##### args?

`unknown`[]

#### Returns

`Promise`\<`T`\>

#### Implementation of

[`IWorkerAdapter`](../interfaces/IWorkerAdapter.md).[`debugQuery`](../interfaces/IWorkerAdapter.md#debugquery)

---

### enableDebug()

> **enableDebug**(): `Promise`\<`void`\>

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

Initialize the adapter.

Acquires a Web Lock for single-tab enforcement before spawning the worker.

#### Returns

`Promise`\<`void`\>

#### Throws

TabLockError if another tab already has the lock

#### Implementation of

[`IWorkerAdapter`](../interfaces/IWorkerAdapter.md).[`initialize`](../interfaces/IWorkerAdapter.md#initialize)
