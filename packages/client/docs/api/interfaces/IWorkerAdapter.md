[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / IWorkerAdapter

# Interface: IWorkerAdapter\<TLink, TCommand\>

Worker adapter — all CQRS components live in a background process
(Web Worker, Electron utility process, etc.). The main thread gets
proxy objects that forward calls via the message protocol.

## Extends

- `IAdapterBase`\<`TLink`\>

## Type Parameters

### TLink

`TLink` _extends_ `Link`

### TCommand

`TCommand` _extends_ [`EnqueueCommand`](EnqueueCommand.md)

## Properties

### cacheManager

> `readonly` **cacheManager**: [`ICacheManager`](ICacheManager.md)\<`TLink`\>

---

### channel

> `readonly` **channel**: [`WorkerMessageChannel`](../@cqrs-toolkit/namespaces/protocol/classes/WorkerMessageChannel.md)

Transport channel to the worker. Exposed so the bootstrap can treat it
as the main-thread IEventSink for local events (log emissions,
etc.) — events pushed through `channel.emit`/`emitDebug` surface on
[events$](#events) alongside events forwarded from the worker without
crossing `postMessage`.

---

### commandQueue

> `readonly` **commandQueue**: [`ICommandQueue`](ICommandQueue.md)\<`TLink`, `TCommand`\>

---

### events$

> `readonly` **events$**: `Observable`\<[`LibraryEvent`](LibraryEvent.md)\<`TLink`, [`LibraryEventType`](../type-aliases/LibraryEventType.md)\>\>

Observable of library events.

#### Inherited from

`IAdapterBase.events$`

---

### kind

> `readonly` **kind**: `"worker"`

---

### queryManager

> `readonly` **queryManager**: [`IQueryManager`](IQueryManager.md)\<`TLink`\>

---

### role?

> `readonly` `optional` **role**: `"leader"` \| `"standby"`

Role of this client instance.
'leader' = active writer (online-only, dedicated-worker, or active shared-worker tab).
'standby' = shared-worker tab waiting for active-tab lock.

#### Inherited from

`IAdapterBase.role`

---

### status

> `readonly` **status**: [`AdapterStatus`](../type-aliases/AdapterStatus.md)

Current adapter status.

#### Inherited from

`IAdapterBase.status`

---

### syncManager

> `readonly` **syncManager**: [`CqrsClientSyncManager`](CqrsClientSyncManager.md)\<`TLink`\>

## Methods

### close()

> **close**(): `Promise`\<`void`\>

Close the adapter and release resources.

#### Returns

`Promise`\<`void`\>

#### Inherited from

`IAdapterBase.close`

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

---

### enableDebug()

> **enableDebug**(): `Promise`\<`void`\>

Enable debug mode in the worker.
Sends a `debug.enable` RPC so the worker starts emitting debug events.
One-way and idempotent — no disable path.

#### Returns

`Promise`\<`void`\>

---

### initialize()

> **initialize**(): `Promise`\<`void`\>

Initialize the adapter.

#### Returns

`Promise`\<`void`\>

#### Inherited from

`IAdapterBase.initialize`
