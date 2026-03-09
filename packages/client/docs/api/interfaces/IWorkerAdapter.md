[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / IWorkerAdapter

# Interface: IWorkerAdapter

Worker adapter provides proxy objects. All orchestration happens in the
worker; createCqrsClient just wraps the proxies.

## Extends

- `IAdapterBase`

## Properties

### cacheManager

> `readonly` **cacheManager**: [`ICacheManager`](ICacheManager.md)

---

### commandQueue

> `readonly` **commandQueue**: [`ICommandQueue`](ICommandQueue.md)

---

### events$

> `readonly` **events$**: `Observable`\<[`LibraryEvent`](LibraryEvent.md)\<[`LibraryEventType`](../type-aliases/LibraryEventType.md)\>\>

Observable of library events.

#### Inherited from

`IAdapterBase.events$`

---

### mode

> `readonly` **mode**: `"shared-worker"` \| `"dedicated-worker"`

---

### queryManager

> `readonly` **queryManager**: [`IQueryManager`](IQueryManager.md)

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

> `readonly` **syncManager**: [`CqrsClientSyncManager`](CqrsClientSyncManager.md)

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
