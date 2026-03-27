[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / OnlineOnlyAdapter

# Class: OnlineOnlyAdapter\<TLink, TSchema, TEvent\>

Online-only adapter for development, testing, and deployments
where offline persistence is not required.

## Type Parameters

### TLink

`TLink` _extends_ `Link`

### TSchema

`TSchema`

### TEvent

`TEvent` _extends_ [`IAnticipatedEvent`](../interfaces/IAnticipatedEvent.md)

## Implements

- [`IOnlineOnlyAdapter`](../interfaces/IOnlineOnlyAdapter.md)\<`TLink`\>

## Constructors

### Constructor

> **new OnlineOnlyAdapter**\<`TLink`, `TSchema`, `TEvent`\>(`config`): `OnlineOnlyAdapter`\<`TLink`, `TSchema`, `TEvent`\>

#### Parameters

##### config

[`ResolvedConfig`](../interfaces/ResolvedConfig.md)\<`TLink`, `TSchema`, `TEvent`\>

#### Returns

`OnlineOnlyAdapter`\<`TLink`, `TSchema`, `TEvent`\>

## Properties

### eventBus

> `readonly` **eventBus**: [`EventBus`](EventBus.md)\<`TLink`\>

#### Implementation of

[`IOnlineOnlyAdapter`](../interfaces/IOnlineOnlyAdapter.md).[`eventBus`](../interfaces/IOnlineOnlyAdapter.md#eventbus)

---

### mode

> `readonly` **mode**: `"online-only"`

#### Implementation of

[`IOnlineOnlyAdapter`](../interfaces/IOnlineOnlyAdapter.md).[`mode`](../interfaces/IOnlineOnlyAdapter.md#mode)

---

### role

> `readonly` **role**: `"leader"`

Role of this client instance.
'leader' = active writer (online-only, dedicated-worker, or active shared-worker tab).
'standby' = shared-worker tab waiting for active-tab lock.

#### Implementation of

[`IOnlineOnlyAdapter`](../interfaces/IOnlineOnlyAdapter.md).[`role`](../interfaces/IOnlineOnlyAdapter.md#role)

## Accessors

### events$

#### Get Signature

> **get** **events$**(): `Observable`\<[`LibraryEvent`](../interfaces/LibraryEvent.md)\<`TLink`, [`LibraryEventType`](../type-aliases/LibraryEventType.md)\>\>

Observable of library events.

##### Returns

`Observable`\<[`LibraryEvent`](../interfaces/LibraryEvent.md)\<`TLink`, [`LibraryEventType`](../type-aliases/LibraryEventType.md)\>\>

Observable of library events.

#### Implementation of

[`IOnlineOnlyAdapter`](../interfaces/IOnlineOnlyAdapter.md).[`events$`](../interfaces/IOnlineOnlyAdapter.md#events)

---

### sessionManager

#### Get Signature

> **get** **sessionManager**(): [`SessionManager`](SessionManager.md)\<`TLink`\>

##### Returns

[`SessionManager`](SessionManager.md)\<`TLink`\>

#### Implementation of

[`IOnlineOnlyAdapter`](../interfaces/IOnlineOnlyAdapter.md).[`sessionManager`](../interfaces/IOnlineOnlyAdapter.md#sessionmanager)

---

### status

#### Get Signature

> **get** **status**(): [`AdapterStatus`](../type-aliases/AdapterStatus.md)

Current adapter status.

##### Returns

[`AdapterStatus`](../type-aliases/AdapterStatus.md)

Current adapter status.

#### Implementation of

[`IOnlineOnlyAdapter`](../interfaces/IOnlineOnlyAdapter.md).[`status`](../interfaces/IOnlineOnlyAdapter.md#status)

---

### storage

#### Get Signature

> **get** **storage**(): [`IStorage`](../interfaces/IStorage.md)\<`TLink`\>

##### Returns

[`IStorage`](../interfaces/IStorage.md)\<`TLink`\>

#### Implementation of

[`IOnlineOnlyAdapter`](../interfaces/IOnlineOnlyAdapter.md).[`storage`](../interfaces/IOnlineOnlyAdapter.md#storage)

## Methods

### close()

> **close**(): `Promise`\<`void`\>

Close the adapter and release resources.

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IOnlineOnlyAdapter`](../interfaces/IOnlineOnlyAdapter.md).[`close`](../interfaces/IOnlineOnlyAdapter.md#close)

---

### initialize()

> **initialize**(): `Promise`\<`void`\>

Initialize the adapter.

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IOnlineOnlyAdapter`](../interfaces/IOnlineOnlyAdapter.md).[`initialize`](../interfaces/IOnlineOnlyAdapter.md#initialize)
