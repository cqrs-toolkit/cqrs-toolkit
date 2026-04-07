[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / OnlineOnlyAdapter

# Class: OnlineOnlyAdapter\<TLink, TCommand, TSchema, TEvent\>

Online-only adapter for development, testing, and deployments
where offline persistence is not required.

## Type Parameters

### TLink

`TLink` _extends_ `Link`

### TCommand

`TCommand` _extends_ [`EnqueueCommand`](../interfaces/EnqueueCommand.md)

### TSchema

`TSchema`

### TEvent

`TEvent` _extends_ [`IAnticipatedEvent`](../interfaces/IAnticipatedEvent.md)

## Implements

- [`IWindowAdapter`](../interfaces/IWindowAdapter.md)\<`TLink`, `TCommand`\>

## Constructors

### Constructor

> **new OnlineOnlyAdapter**\<`TLink`, `TCommand`, `TSchema`, `TEvent`\>(`config`): `OnlineOnlyAdapter`\<`TLink`, `TCommand`, `TSchema`, `TEvent`\>

#### Parameters

##### config

[`ResolvedConfig`](../interfaces/ResolvedConfig.md)\<`TLink`, `TCommand`, `TSchema`, `TEvent`\>

#### Returns

`OnlineOnlyAdapter`\<`TLink`, `TCommand`, `TSchema`, `TEvent`\>

## Properties

### eventBus

> `readonly` **eventBus**: [`EventBus`](EventBus.md)\<`TLink`\>

#### Implementation of

[`IWindowAdapter`](../interfaces/IWindowAdapter.md).[`eventBus`](../interfaces/IWindowAdapter.md#eventbus)

---

### kind

> `readonly` **kind**: `"window"`

#### Implementation of

[`IWindowAdapter`](../interfaces/IWindowAdapter.md).[`kind`](../interfaces/IWindowAdapter.md#kind)

---

### role

> `readonly` **role**: `"leader"`

Role of this client instance.
'leader' = active writer (online-only, dedicated-worker, or active shared-worker tab).
'standby' = shared-worker tab waiting for active-tab lock.

#### Implementation of

[`IWindowAdapter`](../interfaces/IWindowAdapter.md).[`role`](../interfaces/IWindowAdapter.md#role)

## Accessors

### events$

#### Get Signature

> **get** **events$**(): `Observable`\<[`LibraryEvent`](../interfaces/LibraryEvent.md)\<`TLink`, [`LibraryEventType`](../type-aliases/LibraryEventType.md)\>\>

Observable of library events.

##### Returns

`Observable`\<[`LibraryEvent`](../interfaces/LibraryEvent.md)\<`TLink`, [`LibraryEventType`](../type-aliases/LibraryEventType.md)\>\>

Observable of library events.

#### Implementation of

[`IWindowAdapter`](../interfaces/IWindowAdapter.md).[`events$`](../interfaces/IWindowAdapter.md#events)

---

### sessionManager

#### Get Signature

> **get** **sessionManager**(): [`SessionManager`](SessionManager.md)\<`TLink`, `TCommand`\>

##### Returns

[`SessionManager`](SessionManager.md)\<`TLink`, `TCommand`\>

#### Implementation of

[`IWindowAdapter`](../interfaces/IWindowAdapter.md).[`sessionManager`](../interfaces/IWindowAdapter.md#sessionmanager)

---

### status

#### Get Signature

> **get** **status**(): [`AdapterStatus`](../type-aliases/AdapterStatus.md)

Current adapter status.

##### Returns

[`AdapterStatus`](../type-aliases/AdapterStatus.md)

Current adapter status.

#### Implementation of

[`IWindowAdapter`](../interfaces/IWindowAdapter.md).[`status`](../interfaces/IWindowAdapter.md#status)

---

### storage

#### Get Signature

> **get** **storage**(): [`IStorage`](../interfaces/IStorage.md)\<`TLink`, `TCommand`\>

##### Returns

[`IStorage`](../interfaces/IStorage.md)\<`TLink`, `TCommand`\>

#### Implementation of

[`IWindowAdapter`](../interfaces/IWindowAdapter.md).[`storage`](../interfaces/IWindowAdapter.md#storage)

## Methods

### close()

> **close**(): `Promise`\<`void`\>

Close the adapter and release resources.

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IWindowAdapter`](../interfaces/IWindowAdapter.md).[`close`](../interfaces/IWindowAdapter.md#close)

---

### initialize()

> **initialize**(): `Promise`\<`void`\>

Initialize the adapter.

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IWindowAdapter`](../interfaces/IWindowAdapter.md).[`initialize`](../interfaces/IWindowAdapter.md#initialize)
