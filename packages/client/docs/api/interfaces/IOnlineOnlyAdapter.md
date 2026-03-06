[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / IOnlineOnlyAdapter

# Interface: IOnlineOnlyAdapter

Defined in: [packages/client/src/adapters/base/IAdapter.ts:66](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/adapters/base/IAdapter.ts#L66)

Online-only adapter provides raw components for main-thread wiring.
createCqrsClient uses storage, eventBus, and sessionManager to wire
CommandQueue, CacheManager, QueryManager, SyncManager etc.

## Extends

- `IAdapterBase`

## Properties

### eventBus

> `readonly` **eventBus**: [`EventBus`](../classes/EventBus.md)

Defined in: [packages/client/src/adapters/base/IAdapter.ts:69](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/adapters/base/IAdapter.ts#L69)

---

### events$

> `readonly` **events$**: `Observable`\<[`LibraryEvent`](LibraryEvent.md)\<[`LibraryEventType`](../type-aliases/LibraryEventType.md)\>\>

Defined in: [packages/client/src/adapters/base/IAdapter.ts:41](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/adapters/base/IAdapter.ts#L41)

Observable of library events.

#### Inherited from

`IAdapterBase.events$`

---

### mode

> `readonly` **mode**: `"online-only"`

Defined in: [packages/client/src/adapters/base/IAdapter.ts:67](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/adapters/base/IAdapter.ts#L67)

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

### sessionManager

> `readonly` **sessionManager**: [`SessionManager`](../classes/SessionManager.md)

Defined in: [packages/client/src/adapters/base/IAdapter.ts:70](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/adapters/base/IAdapter.ts#L70)

---

### status

> `readonly` **status**: [`AdapterStatus`](../type-aliases/AdapterStatus.md)

Defined in: [packages/client/src/adapters/base/IAdapter.ts:36](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/adapters/base/IAdapter.ts#L36)

Current adapter status.

#### Inherited from

`IAdapterBase.status`

---

### storage

> `readonly` **storage**: [`IStorage`](IStorage.md)

Defined in: [packages/client/src/adapters/base/IAdapter.ts:68](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/adapters/base/IAdapter.ts#L68)

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

### initialize()

> **initialize**(): `Promise`\<`void`\>

Defined in: [packages/client/src/adapters/base/IAdapter.ts:53](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/adapters/base/IAdapter.ts#L53)

Initialize the adapter.

#### Returns

`Promise`\<`void`\>

#### Inherited from

`IAdapterBase.initialize`
