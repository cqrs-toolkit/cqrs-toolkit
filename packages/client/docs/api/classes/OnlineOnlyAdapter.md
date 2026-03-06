[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / OnlineOnlyAdapter

# Class: OnlineOnlyAdapter

Defined in: [packages/client/src/adapters/online-only/OnlineOnlyAdapter.ts:21](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/adapters/online-only/OnlineOnlyAdapter.ts#L21)

Online-only adapter for development, testing, and deployments
where offline persistence is not required.

## Implements

- [`IOnlineOnlyAdapter`](../interfaces/IOnlineOnlyAdapter.md)

## Constructors

### Constructor

> **new OnlineOnlyAdapter**(`_config`): `OnlineOnlyAdapter`

Defined in: [packages/client/src/adapters/online-only/OnlineOnlyAdapter.ts:29](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/adapters/online-only/OnlineOnlyAdapter.ts#L29)

#### Parameters

##### \_config

[`ResolvedConfig`](../interfaces/ResolvedConfig.md)

#### Returns

`OnlineOnlyAdapter`

## Properties

### eventBus

> `readonly` **eventBus**: [`EventBus`](EventBus.md)

Defined in: [packages/client/src/adapters/online-only/OnlineOnlyAdapter.ts:23](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/adapters/online-only/OnlineOnlyAdapter.ts#L23)

#### Implementation of

[`IOnlineOnlyAdapter`](../interfaces/IOnlineOnlyAdapter.md).[`eventBus`](../interfaces/IOnlineOnlyAdapter.md#eventbus)

---

### mode

> `readonly` **mode**: `"online-only"`

Defined in: [packages/client/src/adapters/online-only/OnlineOnlyAdapter.ts:22](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/adapters/online-only/OnlineOnlyAdapter.ts#L22)

#### Implementation of

[`IOnlineOnlyAdapter`](../interfaces/IOnlineOnlyAdapter.md).[`mode`](../interfaces/IOnlineOnlyAdapter.md#mode)

## Accessors

### events$

#### Get Signature

> **get** **events$**(): `Observable`\<[`LibraryEvent`](../interfaces/LibraryEvent.md)\<[`LibraryEventType`](../type-aliases/LibraryEventType.md)\>\>

Defined in: [packages/client/src/adapters/online-only/OnlineOnlyAdapter.ts:37](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/adapters/online-only/OnlineOnlyAdapter.ts#L37)

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

Defined in: [packages/client/src/adapters/online-only/OnlineOnlyAdapter.ts:41](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/adapters/online-only/OnlineOnlyAdapter.ts#L41)

##### Returns

[`SessionManager`](SessionManager.md)

#### Implementation of

[`IOnlineOnlyAdapter`](../interfaces/IOnlineOnlyAdapter.md).[`sessionManager`](../interfaces/IOnlineOnlyAdapter.md#sessionmanager)

---

### status

#### Get Signature

> **get** **status**(): [`AdapterStatus`](../type-aliases/AdapterStatus.md)

Defined in: [packages/client/src/adapters/online-only/OnlineOnlyAdapter.ts:33](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/adapters/online-only/OnlineOnlyAdapter.ts#L33)

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

Defined in: [packages/client/src/adapters/online-only/OnlineOnlyAdapter.ts:46](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/adapters/online-only/OnlineOnlyAdapter.ts#L46)

##### Returns

[`IStorage`](../interfaces/IStorage.md)

#### Implementation of

[`IOnlineOnlyAdapter`](../interfaces/IOnlineOnlyAdapter.md).[`storage`](../interfaces/IOnlineOnlyAdapter.md#storage)

## Methods

### close()

> **close**(): `Promise`\<`void`\>

Defined in: [packages/client/src/adapters/online-only/OnlineOnlyAdapter.ts:73](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/adapters/online-only/OnlineOnlyAdapter.ts#L73)

Close the adapter and release resources.

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IOnlineOnlyAdapter`](../interfaces/IOnlineOnlyAdapter.md).[`close`](../interfaces/IOnlineOnlyAdapter.md#close)

---

### initialize()

> **initialize**(): `Promise`\<`void`\>

Defined in: [packages/client/src/adapters/online-only/OnlineOnlyAdapter.ts:51](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/adapters/online-only/OnlineOnlyAdapter.ts#L51)

Initialize the adapter.

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IOnlineOnlyAdapter`](../interfaces/IOnlineOnlyAdapter.md).[`initialize`](../interfaces/IOnlineOnlyAdapter.md#initialize)
