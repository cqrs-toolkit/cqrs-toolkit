[**@cqrs-toolkit/client-electron**](../../README.md)

---

[@cqrs-toolkit/client-electron](../../modules.md) / [index](../README.md) / ElectronAdapter

# Class: ElectronAdapter\<TLink, TCommand\>

Electron adapter — implements IWorkerAdapter for the renderer process.

Simplified compared to DedicatedWorkerAdapter:

- No Web Locks (Electron manages windows)
- No worker spawning (main process bridge handles it)
- No OPFS file store (FsCommandFileStore runs in the utility process)

## Type Parameters

### TLink

`TLink` _extends_ `Link`

### TCommand

`TCommand` _extends_ `EnqueueCommand`

## Implements

- `IWorkerAdapter`\<`TLink`, `TCommand`\>

## Constructors

### Constructor

> **new ElectronAdapter**\<`TLink`, `TCommand`\>(`config`): `ElectronAdapter`\<`TLink`, `TCommand`\>

#### Parameters

##### config

[`ElectronAdapterConfig`](../interfaces/ElectronAdapterConfig.md)

#### Returns

`ElectronAdapter`\<`TLink`, `TCommand`\>

## Properties

### kind

> `readonly` **kind**: `"worker"`

#### Implementation of

`IWorkerAdapter.kind`

---

### role

> `readonly` **role**: `"leader"`

Role of this client instance.
'leader' = active writer (online-only, dedicated-worker, or active shared-worker tab).
'standby' = shared-worker tab waiting for active-tab lock.

#### Implementation of

`IWorkerAdapter.role`

## Accessors

### cacheManager

#### Get Signature

> **get** **cacheManager**(): `ICacheManager`\<`TLink`\>

##### Returns

`ICacheManager`\<`TLink`\>

#### Implementation of

`IWorkerAdapter.cacheManager`

---

### channel

#### Get Signature

> **get** **channel**(): `WorkerMessageChannel`

Transport channel to the worker. Exposed so the bootstrap can treat it
as the main-thread IEventSink for local events (log emissions,
etc.) — events pushed through `channel.emit`/`emitDebug` surface on
[events$](#events) alongside events forwarded from the worker without
crossing `postMessage`.

##### Returns

`WorkerMessageChannel`

#### Implementation of

`IWorkerAdapter.channel`

---

### commandQueue

#### Get Signature

> **get** **commandQueue**(): `ICommandQueue`\<`TLink`, `TCommand`\>

##### Returns

`ICommandQueue`\<`TLink`, `TCommand`\>

#### Implementation of

`IWorkerAdapter.commandQueue`

---

### events$

#### Get Signature

> **get** **events$**(): `Observable`\<`LibraryEvent`\<`TLink`, `LibraryEventType`\>\>

Observable of library events.

##### Returns

`Observable`\<`LibraryEvent`\<`TLink`, `LibraryEventType`\>\>

#### Implementation of

`IWorkerAdapter.events$`

---

### queryManager

#### Get Signature

> **get** **queryManager**(): `IQueryManager`\<`TLink`\>

##### Returns

`IQueryManager`\<`TLink`\>

#### Implementation of

`IWorkerAdapter.queryManager`

---

### status

#### Get Signature

> **get** **status**(): `AdapterStatus`

Current adapter status.

##### Returns

`AdapterStatus`

#### Implementation of

`IWorkerAdapter.status`

---

### syncManager

#### Get Signature

> **get** **syncManager**(): `CqrsClientSyncManager`\<`TLink`\>

##### Returns

`CqrsClientSyncManager`\<`TLink`\>

#### Implementation of

`IWorkerAdapter.syncManager`

## Methods

### close()

> **close**(): `Promise`\<`void`\>

Close the adapter and release resources.

#### Returns

`Promise`\<`void`\>

#### Implementation of

`IWorkerAdapter.close`

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

`IWorkerAdapter.debugQuery`

---

### enableDebug()

> **enableDebug**(): `Promise`\<`void`\>

Enable debug mode in the worker.
Sends a `debug.enable` RPC so the worker starts emitting debug events.
One-way and idempotent — no disable path.

#### Returns

`Promise`\<`void`\>

#### Implementation of

`IWorkerAdapter.enableDebug`

---

### initialize()

> **initialize**(): `Promise`\<`void`\>

Initialize the adapter.

#### Returns

`Promise`\<`void`\>

#### Implementation of

`IWorkerAdapter.initialize`
