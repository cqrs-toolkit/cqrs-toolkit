[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / IWorkerAdapter

# Interface: IWorkerAdapter

Defined in: [packages/client/src/adapters/base/IAdapter.ts:77](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/adapters/base/IAdapter.ts#L77)

Worker adapter provides proxy objects. All orchestration happens in the
worker; createCqrsClient just wraps the proxies.

## Extends

- `IAdapterBase`

## Properties

### cacheManager

> `readonly` **cacheManager**: [`ICacheManager`](ICacheManager.md)

Defined in: [packages/client/src/adapters/base/IAdapter.ts:81](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/adapters/base/IAdapter.ts#L81)

---

### commandQueue

> `readonly` **commandQueue**: [`ICommandQueue`](ICommandQueue.md)

Defined in: [packages/client/src/adapters/base/IAdapter.ts:79](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/adapters/base/IAdapter.ts#L79)

---

### events$

> `readonly` **events$**: `Observable`\<[`LibraryEvent`](LibraryEvent.md)\<[`LibraryEventType`](../type-aliases/LibraryEventType.md)\>\>

Defined in: [packages/client/src/adapters/base/IAdapter.ts:41](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/adapters/base/IAdapter.ts#L41)

Observable of library events.

#### Inherited from

`IAdapterBase.events$`

---

### mode

> `readonly` **mode**: `"shared-worker"` \| `"dedicated-worker"`

Defined in: [packages/client/src/adapters/base/IAdapter.ts:78](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/adapters/base/IAdapter.ts#L78)

---

### queryManager

> `readonly` **queryManager**: [`IQueryManager`](IQueryManager.md)

Defined in: [packages/client/src/adapters/base/IAdapter.ts:80](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/adapters/base/IAdapter.ts#L80)

---

### role?

> `readonly` `optional` **role**: `"leader"` \| `"standby"`

Defined in: [packages/client/src/adapters/base/IAdapter.ts:48](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/adapters/base/IAdapter.ts#L48)

Role of this client instance.
'leader' = active writer (online-only, dedicated-worker, or active shared-worker tab).
'standby' = shared-worker tab waiting for active-tab lock.

#### Inherited from

`IAdapterBase.role`

---

### status

> `readonly` **status**: [`AdapterStatus`](../type-aliases/AdapterStatus.md)

Defined in: [packages/client/src/adapters/base/IAdapter.ts:36](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/adapters/base/IAdapter.ts#L36)

Current adapter status.

#### Inherited from

`IAdapterBase.status`

---

### syncManager

> `readonly` **syncManager**: [`CqrsClientSyncManager`](CqrsClientSyncManager.md)

Defined in: [packages/client/src/adapters/base/IAdapter.ts:82](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/adapters/base/IAdapter.ts#L82)

## Methods

### close()

> **close**(): `Promise`\<`void`\>

Defined in: [packages/client/src/adapters/base/IAdapter.ts:58](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/adapters/base/IAdapter.ts#L58)

Close the adapter and release resources.

#### Returns

`Promise`\<`void`\>

#### Inherited from

`IAdapterBase.close`

---

### debugQuery()

> **debugQuery**\<`T`\>(`method`, `args?`): `Promise`\<`T`\>

Defined in: [packages/client/src/adapters/base/IAdapter.ts:95](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/adapters/base/IAdapter.ts#L95)

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

Defined in: [packages/client/src/adapters/base/IAdapter.ts:89](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/adapters/base/IAdapter.ts#L89)

Enable debug mode in the worker.
Sends a `debug.enable` RPC so the worker starts emitting debug events.
One-way and idempotent — no disable path.

#### Returns

`Promise`\<`void`\>

---

### initialize()

> **initialize**(): `Promise`\<`void`\>

Defined in: [packages/client/src/adapters/base/IAdapter.ts:53](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/adapters/base/IAdapter.ts#L53)

Initialize the adapter.

#### Returns

`Promise`\<`void`\>

#### Inherited from

`IAdapterBase.initialize`
