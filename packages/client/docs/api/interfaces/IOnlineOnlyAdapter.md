[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / IOnlineOnlyAdapter

# Interface: IOnlineOnlyAdapter\<TLink, TCommand\>

Online-only adapter provides raw components for main-thread wiring.
createCqrsClient uses storage, eventBus, and sessionManager to wire
CommandQueue, CacheManager, QueryManager, SyncManager etc.

## Extends

- `IAdapterBase`\<`TLink`\>

## Type Parameters

### TLink

`TLink` _extends_ `Link`

### TCommand

`TCommand` _extends_ [`EnqueueCommand`](EnqueueCommand.md)

## Properties

### eventBus

> `readonly` **eventBus**: [`EventBus`](../classes/EventBus.md)\<`TLink`\>

---

### events$

> `readonly` **events$**: `Observable`\<[`LibraryEvent`](LibraryEvent.md)\<`TLink`, [`LibraryEventType`](../type-aliases/LibraryEventType.md)\>\>

Observable of library events.

#### Inherited from

`IAdapterBase.events$`

---

### mode

> `readonly` **mode**: `"online-only"`

---

### role?

> `readonly` `optional` **role**: `"leader"` \| `"standby"`

Role of this client instance.
'leader' = active writer (online-only, dedicated-worker, or active shared-worker tab).
'standby' = shared-worker tab waiting for active-tab lock.

#### Inherited from

`IAdapterBase.role`

---

### sessionManager

> `readonly` **sessionManager**: [`SessionManager`](../classes/SessionManager.md)\<`TLink`, `TCommand`\>

---

### status

> `readonly` **status**: [`AdapterStatus`](../type-aliases/AdapterStatus.md)

Current adapter status.

#### Inherited from

`IAdapterBase.status`

---

### storage

> `readonly` **storage**: [`IStorage`](IStorage.md)\<`TLink`, `TCommand`\>

## Methods

### close()

> **close**(): `Promise`\<`void`\>

Close the adapter and release resources.

#### Returns

`Promise`\<`void`\>

#### Inherited from

`IAdapterBase.close`

---

### initialize()

> **initialize**(): `Promise`\<`void`\>

Initialize the adapter.

#### Returns

`Promise`\<`void`\>

#### Inherited from

`IAdapterBase.initialize`
