[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / OnlineOnlyAdapter

# Class: OnlineOnlyAdapter

Defined in: [packages/client/src/adapters/online-only/OnlineOnlyAdapter.ts:21](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/adapters/online-only/OnlineOnlyAdapter.ts#L21)

Online-only adapter for development, testing, and deployments
where offline persistence is not required.

## Implements

- [`IOnlineOnlyAdapter`](../interfaces/IOnlineOnlyAdapter.md)

## Constructors

### Constructor

> **new OnlineOnlyAdapter**(`config`): `OnlineOnlyAdapter`

Defined in: [packages/client/src/adapters/online-only/OnlineOnlyAdapter.ts:30](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/adapters/online-only/OnlineOnlyAdapter.ts#L30)

#### Parameters

##### config

[`ResolvedConfig`](../interfaces/ResolvedConfig.md)

#### Returns

`OnlineOnlyAdapter`

## Properties

### eventBus

> `readonly` **eventBus**: [`EventBus`](EventBus.md)

Defined in: [packages/client/src/adapters/online-only/OnlineOnlyAdapter.ts:24](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/adapters/online-only/OnlineOnlyAdapter.ts#L24)

#### Implementation of

[`IOnlineOnlyAdapter`](../interfaces/IOnlineOnlyAdapter.md).[`eventBus`](../interfaces/IOnlineOnlyAdapter.md#eventbus)

---

### mode

> `readonly` **mode**: `"online-only"`

Defined in: [packages/client/src/adapters/online-only/OnlineOnlyAdapter.ts:22](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/adapters/online-only/OnlineOnlyAdapter.ts#L22)

#### Implementation of

[`IOnlineOnlyAdapter`](../interfaces/IOnlineOnlyAdapter.md).[`mode`](../interfaces/IOnlineOnlyAdapter.md#mode)

---

### role

> `readonly` **role**: `"leader"`

Defined in: [packages/client/src/adapters/online-only/OnlineOnlyAdapter.ts:23](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/adapters/online-only/OnlineOnlyAdapter.ts#L23)

Role of this client instance.
'leader' = active writer (online-only, dedicated-worker, or active shared-worker tab).
'standby' = shared-worker tab waiting for active-tab lock.

#### Implementation of

[`IOnlineOnlyAdapter`](../interfaces/IOnlineOnlyAdapter.md).[`role`](../interfaces/IOnlineOnlyAdapter.md#role)

## Accessors

### events$

#### Get Signature

> **get** **events$**(): `Observable`\<[`LibraryEvent`](../interfaces/LibraryEvent.md)\<[`LibraryEventType`](../type-aliases/LibraryEventType.md)\>\>

Defined in: [packages/client/src/adapters/online-only/OnlineOnlyAdapter.ts:39](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/adapters/online-only/OnlineOnlyAdapter.ts#L39)

Observable of library events.

##### Returns

`Observable`\<[`LibraryEvent`](../interfaces/LibraryEvent.md)\<[`LibraryEventType`](../type-aliases/LibraryEventType.md)\>\>

Observable of library events.

#### Implementation of

[`IOnlineOnlyAdapter`](../interfaces/IOnlineOnlyAdapter.md).[`events$`](../interfaces/IOnlineOnlyAdapter.md#events)

---

### sessionManager

#### Get Signature

> **get** **sessionManager**(): [`SessionManager`](SessionManager.md)

Defined in: [packages/client/src/adapters/online-only/OnlineOnlyAdapter.ts:43](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/adapters/online-only/OnlineOnlyAdapter.ts#L43)

##### Returns

[`SessionManager`](SessionManager.md)

#### Implementation of

[`IOnlineOnlyAdapter`](../interfaces/IOnlineOnlyAdapter.md).[`sessionManager`](../interfaces/IOnlineOnlyAdapter.md#sessionmanager)

---

### status

#### Get Signature

> **get** **status**(): [`AdapterStatus`](../type-aliases/AdapterStatus.md)

Defined in: [packages/client/src/adapters/online-only/OnlineOnlyAdapter.ts:35](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/adapters/online-only/OnlineOnlyAdapter.ts#L35)

Current adapter status.

##### Returns

[`AdapterStatus`](../type-aliases/AdapterStatus.md)

Current adapter status.

#### Implementation of

[`IOnlineOnlyAdapter`](../interfaces/IOnlineOnlyAdapter.md).[`status`](../interfaces/IOnlineOnlyAdapter.md#status)

---

### storage

#### Get Signature

> **get** **storage**(): [`IStorage`](../interfaces/IStorage.md)

Defined in: [packages/client/src/adapters/online-only/OnlineOnlyAdapter.ts:48](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/adapters/online-only/OnlineOnlyAdapter.ts#L48)

##### Returns

[`IStorage`](../interfaces/IStorage.md)

#### Implementation of

[`IOnlineOnlyAdapter`](../interfaces/IOnlineOnlyAdapter.md).[`storage`](../interfaces/IOnlineOnlyAdapter.md#storage)

## Methods

### close()

> **close**(): `Promise`\<`void`\>

Defined in: [packages/client/src/adapters/online-only/OnlineOnlyAdapter.ts:75](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/adapters/online-only/OnlineOnlyAdapter.ts#L75)

Close the adapter and release resources.

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IOnlineOnlyAdapter`](../interfaces/IOnlineOnlyAdapter.md).[`close`](../interfaces/IOnlineOnlyAdapter.md#close)

---

### initialize()

> **initialize**(): `Promise`\<`void`\>

Defined in: [packages/client/src/adapters/online-only/OnlineOnlyAdapter.ts:53](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/adapters/online-only/OnlineOnlyAdapter.ts#L53)

Initialize the adapter.

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IOnlineOnlyAdapter`](../interfaces/IOnlineOnlyAdapter.md).[`initialize`](../interfaces/IOnlineOnlyAdapter.md#initialize)
