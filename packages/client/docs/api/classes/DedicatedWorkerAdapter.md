[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / DedicatedWorkerAdapter

# Class: DedicatedWorkerAdapter\<TLink, TCommand\>

Dedicated Worker adapter for single-tab offline support.

This adapter:

- Acquires a Web Lock to enforce single-tab operation
- Connects to a Dedicated Worker that owns all CQRS components
- Provides proxy objects for main-thread consumers

## Type Parameters

### TLink

`TLink` _extends_ `Link`

### TCommand

`TCommand` _extends_ [`EnqueueCommand`](../interfaces/EnqueueCommand.md)

## Implements

- [`IWorkerAdapter`](../interfaces/IWorkerAdapter.md)\<`TLink`, `TCommand`\>

## Constructors

### Constructor

> **new DedicatedWorkerAdapter**\<`TLink`, `TCommand`\>(`config`): `DedicatedWorkerAdapter`\<`TLink`, `TCommand`\>

#### Parameters

##### config

[`DedicatedWorkerAdapterConfig`](../interfaces/DedicatedWorkerAdapterConfig.md)

#### Returns

`DedicatedWorkerAdapter`\<`TLink`, `TCommand`\>

## Properties

### kind

> `readonly` **kind**: `"worker"`

#### Implementation of

[`IWorkerAdapter`](../interfaces/IWorkerAdapter.md).[`kind`](../interfaces/IWorkerAdapter.md#kind)

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

> **get** **cacheManager**(): [`ICacheManager`](../interfaces/ICacheManager.md)\<`TLink`\>

##### Returns

[`ICacheManager`](../interfaces/ICacheManager.md)\<`TLink`\>

#### Implementation of

[`IWorkerAdapter`](../interfaces/IWorkerAdapter.md).[`cacheManager`](../interfaces/IWorkerAdapter.md#cachemanager)

---

### channel

#### Get Signature

> **get** **channel**(): [`WorkerMessageChannel`](../@cqrs-toolkit/namespaces/protocol/classes/WorkerMessageChannel.md)

Transport channel to the worker. Exposed so the bootstrap can treat it
as the main-thread IEventSink for local events (log emissions,
etc.) — events pushed through `channel.emit`/`emitDebug` surface on
[events$](../interfaces/IWorkerAdapter.md#events) alongside events forwarded from the worker without
crossing `postMessage`.

##### Returns

[`WorkerMessageChannel`](../@cqrs-toolkit/namespaces/protocol/classes/WorkerMessageChannel.md)

Transport channel to the worker. Exposed so the bootstrap can treat it
as the main-thread IEventSink for local events (log emissions,
etc.) — events pushed through `channel.emit`/`emitDebug` surface on
[events$](../interfaces/IWorkerAdapter.md#events) alongside events forwarded from the worker without
crossing `postMessage`.

#### Implementation of

[`IWorkerAdapter`](../interfaces/IWorkerAdapter.md).[`channel`](../interfaces/IWorkerAdapter.md#channel)

---

### commandQueue

#### Get Signature

> **get** **commandQueue**(): [`ICommandQueue`](../interfaces/ICommandQueue.md)\<`TLink`, `TCommand`\>

##### Returns

[`ICommandQueue`](../interfaces/ICommandQueue.md)\<`TLink`, `TCommand`\>

#### Implementation of

[`IWorkerAdapter`](../interfaces/IWorkerAdapter.md).[`commandQueue`](../interfaces/IWorkerAdapter.md#commandqueue)

---

### events$

#### Get Signature

> **get** **events$**(): `Observable`\<[`LibraryEvent`](../interfaces/LibraryEvent.md)\<`TLink`, [`LibraryEventType`](../type-aliases/LibraryEventType.md)\>\>

Observable of library events.

##### Returns

`Observable`\<[`LibraryEvent`](../interfaces/LibraryEvent.md)\<`TLink`, [`LibraryEventType`](../type-aliases/LibraryEventType.md)\>\>

Observable of library events.

#### Implementation of

[`IWorkerAdapter`](../interfaces/IWorkerAdapter.md).[`events$`](../interfaces/IWorkerAdapter.md#events)

---

### queryManager

#### Get Signature

> **get** **queryManager**(): [`IQueryManager`](../interfaces/IQueryManager.md)\<`TLink`\>

##### Returns

[`IQueryManager`](../interfaces/IQueryManager.md)\<`TLink`\>

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

> **get** **syncManager**(): [`CqrsClientSyncManager`](../interfaces/CqrsClientSyncManager.md)\<`TLink`\>

##### Returns

[`CqrsClientSyncManager`](../interfaces/CqrsClientSyncManager.md)\<`TLink`\>

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
