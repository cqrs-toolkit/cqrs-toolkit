[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / IOnlineOnlyAdapter

# Interface: IOnlineOnlyAdapter

Defined in: [packages/client/src/adapters/base/IAdapter.ts:59](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/adapters/base/IAdapter.ts#L59)

Online-only adapter provides raw components for main-thread wiring.
createCqrsClient uses storage, eventBus, and sessionManager to wire
CommandQueue, CacheManager, QueryManager, SyncManager etc.

## Extends

- `IAdapterBase`

## Properties

### eventBus

> `readonly` **eventBus**: [`EventBus`](../classes/EventBus.md)

Defined in: [packages/client/src/adapters/base/IAdapter.ts:62](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/adapters/base/IAdapter.ts#L62)

---

### events$

> `readonly` **events$**: `Observable`\<[`LibraryEvent`](LibraryEvent.md)\<[`LibraryEventType`](../type-aliases/LibraryEventType.md)\>\>

Defined in: [packages/client/src/adapters/base/IAdapter.ts:41](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/adapters/base/IAdapter.ts#L41)

Observable of library events.

#### Inherited from

`IAdapterBase.events$`

---

### mode

> `readonly` **mode**: `"online-only"`

Defined in: [packages/client/src/adapters/base/IAdapter.ts:60](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/adapters/base/IAdapter.ts#L60)

---

### sessionManager

> `readonly` **sessionManager**: [`SessionManager`](../classes/SessionManager.md)

Defined in: [packages/client/src/adapters/base/IAdapter.ts:63](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/adapters/base/IAdapter.ts#L63)

---

### status

> `readonly` **status**: [`AdapterStatus`](../type-aliases/AdapterStatus.md)

Defined in: [packages/client/src/adapters/base/IAdapter.ts:36](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/adapters/base/IAdapter.ts#L36)

Current adapter status.

#### Inherited from

`IAdapterBase.status`

---

### storage

> `readonly` **storage**: [`IStorage`](IStorage.md)

Defined in: [packages/client/src/adapters/base/IAdapter.ts:61](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/adapters/base/IAdapter.ts#L61)

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
