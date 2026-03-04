[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / OnlineOnlyAdapter

# Class: OnlineOnlyAdapter

Defined in: packages/client/src/adapters/online-only/OnlineOnlyAdapter.ts:21

Online-only adapter for development, testing, and deployments
where offline persistence is not required.

## Implements

- [`IAdapter`](../interfaces/IAdapter.md)

## Constructors

### Constructor

> **new OnlineOnlyAdapter**(`_config`): `OnlineOnlyAdapter`

Defined in: packages/client/src/adapters/online-only/OnlineOnlyAdapter.ts:29

#### Parameters

##### \_config

[`ResolvedConfig`](../interfaces/ResolvedConfig.md)

#### Returns

`OnlineOnlyAdapter`

## Properties

### eventBus

> `readonly` **eventBus**: [`EventBus`](EventBus.md)

Defined in: packages/client/src/adapters/online-only/OnlineOnlyAdapter.ts:23

Event bus instance for wiring core components.

#### Implementation of

[`IAdapter`](../interfaces/IAdapter.md).[`eventBus`](../interfaces/IAdapter.md#eventbus)

---

### mode

> `readonly` **mode**: [`ExecutionMode`](../type-aliases/ExecutionMode.md) = `'online-only'`

Defined in: packages/client/src/adapters/online-only/OnlineOnlyAdapter.ts:22

Execution mode of this adapter.

#### Implementation of

[`IAdapter`](../interfaces/IAdapter.md).[`mode`](../interfaces/IAdapter.md#mode)

## Accessors

### events$

#### Get Signature

> **get** **events$**(): `Observable`\<[`LibraryEvent`](../interfaces/LibraryEvent.md)\<[`LibraryEventType`](../type-aliases/LibraryEventType.md)\>\>

Defined in: packages/client/src/adapters/online-only/OnlineOnlyAdapter.ts:37

Observable of library events.

##### Returns

`Observable`\<[`LibraryEvent`](../interfaces/LibraryEvent.md)\<[`LibraryEventType`](../type-aliases/LibraryEventType.md)\>\>

Observable of library events.

#### Implementation of

[`IAdapter`](../interfaces/IAdapter.md).[`events$`](../interfaces/IAdapter.md#events)

---

### sessionManager

#### Get Signature

> **get** **sessionManager**(): [`SessionManager`](SessionManager.md)

Defined in: packages/client/src/adapters/online-only/OnlineOnlyAdapter.ts:41

Session manager instance.

##### Returns

[`SessionManager`](SessionManager.md)

Session manager instance.

#### Implementation of

[`IAdapter`](../interfaces/IAdapter.md).[`sessionManager`](../interfaces/IAdapter.md#sessionmanager)

---

### status

#### Get Signature

> **get** **status**(): [`AdapterStatus`](../type-aliases/AdapterStatus.md)

Defined in: packages/client/src/adapters/online-only/OnlineOnlyAdapter.ts:33

Current adapter status.

##### Returns

[`AdapterStatus`](../type-aliases/AdapterStatus.md)

Current adapter status.

#### Implementation of

[`IAdapter`](../interfaces/IAdapter.md).[`status`](../interfaces/IAdapter.md#status)

---

### storage

#### Get Signature

> **get** **storage**(): [`IStorage`](../interfaces/IStorage.md)

Defined in: packages/client/src/adapters/online-only/OnlineOnlyAdapter.ts:46

Storage instance.

##### Returns

[`IStorage`](../interfaces/IStorage.md)

Storage instance.

#### Implementation of

[`IAdapter`](../interfaces/IAdapter.md).[`storage`](../interfaces/IAdapter.md#storage)

## Methods

### close()

> **close**(): `Promise`\<`void`\>

Defined in: packages/client/src/adapters/online-only/OnlineOnlyAdapter.ts:73

Close the adapter and release resources.

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IAdapter`](../interfaces/IAdapter.md).[`close`](../interfaces/IAdapter.md#close)

---

### initialize()

> **initialize**(): `Promise`\<`void`\>

Defined in: packages/client/src/adapters/online-only/OnlineOnlyAdapter.ts:51

Initialize the adapter.

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IAdapter`](../interfaces/IAdapter.md).[`initialize`](../interfaces/IAdapter.md#initialize)
