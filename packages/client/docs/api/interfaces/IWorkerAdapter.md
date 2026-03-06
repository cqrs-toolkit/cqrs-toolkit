[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / IWorkerAdapter

# Interface: IWorkerAdapter

Defined in: [packages/client/src/adapters/base/IAdapter.ts:70](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/adapters/base/IAdapter.ts#L70)

Worker adapter provides proxy objects. All orchestration happens in the
worker; createCqrsClient just wraps the proxies.

## Extends

- `IAdapterBase`

## Properties

### cacheManager

> `readonly` **cacheManager**: [`ICacheManager`](ICacheManager.md)

Defined in: [packages/client/src/adapters/base/IAdapter.ts:74](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/adapters/base/IAdapter.ts#L74)

---

### commandQueue

> `readonly` **commandQueue**: [`ICommandQueue`](ICommandQueue.md)

Defined in: [packages/client/src/adapters/base/IAdapter.ts:72](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/adapters/base/IAdapter.ts#L72)

---

### events$

> `readonly` **events$**: `Observable`\<[`LibraryEvent`](LibraryEvent.md)\<[`LibraryEventType`](../type-aliases/LibraryEventType.md)\>\>

Defined in: [packages/client/src/adapters/base/IAdapter.ts:41](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/adapters/base/IAdapter.ts#L41)

Observable of library events.

#### Inherited from

`IAdapterBase.events$`

---

### mode

> `readonly` **mode**: `"shared-worker"` \| `"dedicated-worker"`

Defined in: [packages/client/src/adapters/base/IAdapter.ts:71](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/adapters/base/IAdapter.ts#L71)

---

### queryManager

> `readonly` **queryManager**: [`IQueryManager`](IQueryManager.md)

Defined in: [packages/client/src/adapters/base/IAdapter.ts:73](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/adapters/base/IAdapter.ts#L73)

---

### status

> `readonly` **status**: [`AdapterStatus`](../type-aliases/AdapterStatus.md)

Defined in: [packages/client/src/adapters/base/IAdapter.ts:36](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/adapters/base/IAdapter.ts#L36)

Current adapter status.

#### Inherited from

`IAdapterBase.status`

---

### syncManager

> `readonly` **syncManager**: [`CqrsClientSyncManager`](CqrsClientSyncManager.md)

Defined in: [packages/client/src/adapters/base/IAdapter.ts:75](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/adapters/base/IAdapter.ts#L75)

## Methods

### close()

> **close**(): `Promise`\<`void`\>

Defined in: [packages/client/src/adapters/base/IAdapter.ts:51](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/adapters/base/IAdapter.ts#L51)

Close the adapter and release resources.

#### Returns

`Promise`\<`void`\>

#### Inherited from

`IAdapterBase.close`

---

### initialize()

> **initialize**(): `Promise`\<`void`\>

Defined in: [packages/client/src/adapters/base/IAdapter.ts:46](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/adapters/base/IAdapter.ts#L46)

Initialize the adapter.

#### Returns

`Promise`\<`void`\>

#### Inherited from

`IAdapterBase.initialize`
