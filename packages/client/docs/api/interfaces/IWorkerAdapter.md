[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / IWorkerAdapter

# Interface: IWorkerAdapter

Defined in: packages/client/src/adapters/base/IAdapter.ts:70

Worker adapter provides proxy objects. All orchestration happens in the
worker; createCqrsClient just wraps the proxies.

## Extends

- `IAdapterBase`

## Properties

### cacheManager

> `readonly` **cacheManager**: [`ICacheManager`](ICacheManager.md)

Defined in: packages/client/src/adapters/base/IAdapter.ts:74

---

### commandQueue

> `readonly` **commandQueue**: [`ICommandQueue`](ICommandQueue.md)

Defined in: packages/client/src/adapters/base/IAdapter.ts:72

---

### events$

> `readonly` **events$**: `Observable`\<[`LibraryEvent`](LibraryEvent.md)\<[`LibraryEventType`](../type-aliases/LibraryEventType.md)\>\>

Defined in: packages/client/src/adapters/base/IAdapter.ts:41

Observable of library events.

#### Inherited from

`IAdapterBase.events$`

---

### mode

> `readonly` **mode**: `"shared-worker"` \| `"dedicated-worker"`

Defined in: packages/client/src/adapters/base/IAdapter.ts:71

---

### queryManager

> `readonly` **queryManager**: [`IQueryManager`](IQueryManager.md)

Defined in: packages/client/src/adapters/base/IAdapter.ts:73

---

### status

> `readonly` **status**: [`AdapterStatus`](../type-aliases/AdapterStatus.md)

Defined in: packages/client/src/adapters/base/IAdapter.ts:36

Current adapter status.

#### Inherited from

`IAdapterBase.status`

---

### syncManager

> `readonly` **syncManager**: [`CqrsClientSyncManager`](CqrsClientSyncManager.md)

Defined in: packages/client/src/adapters/base/IAdapter.ts:75

## Methods

### close()

> **close**(): `Promise`\<`void`\>

Defined in: packages/client/src/adapters/base/IAdapter.ts:51

Close the adapter and release resources.

#### Returns

`Promise`\<`void`\>

#### Inherited from

`IAdapterBase.close`

---

### initialize()

> **initialize**(): `Promise`\<`void`\>

Defined in: packages/client/src/adapters/base/IAdapter.ts:46

Initialize the adapter.

#### Returns

`Promise`\<`void`\>

#### Inherited from

`IAdapterBase.initialize`
