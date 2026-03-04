[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / SharedWorkerAdapter

# Class: SharedWorkerAdapter

Defined in: packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts:43

SharedWorker adapter for multi-tab offline support.

This adapter:

- Connects to a SharedWorker that manages SQLite storage
- Provides a storage proxy for window-side code
- Handles window registration and heartbeats
- Restores holds after worker restarts

## Implements

- [`IAdapter`](../interfaces/IAdapter.md)

## Constructors

### Constructor

> **new SharedWorkerAdapter**(`config`): `SharedWorkerAdapter`

Defined in: packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts:63

#### Parameters

##### config

[`SharedWorkerAdapterConfig`](../interfaces/SharedWorkerAdapterConfig.md)

#### Returns

`SharedWorkerAdapter`

## Properties

### eventBus

> `readonly` **eventBus**: [`EventBus`](EventBus.md)

Defined in: packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts:47

Event bus instance for wiring core components.

#### Implementation of

[`IAdapter`](../interfaces/IAdapter.md).[`eventBus`](../interfaces/IAdapter.md#eventbus)

---

### mode

> `readonly` **mode**: [`ExecutionMode`](../type-aliases/ExecutionMode.md) = `'shared-worker'`

Defined in: packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts:44

Execution mode of this adapter.

#### Implementation of

[`IAdapter`](../interfaces/IAdapter.md).[`mode`](../interfaces/IAdapter.md#mode)

## Accessors

### events$

#### Get Signature

> **get** **events$**(): `Observable`\<[`LibraryEvent`](../interfaces/LibraryEvent.md)\<[`LibraryEventType`](../type-aliases/LibraryEventType.md)\>\>

Defined in: packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts:73

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

Defined in: packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts:77

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

Defined in: packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts:69

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

Defined in: packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts:82

Storage instance.

##### Returns

[`IStorage`](../interfaces/IStorage.md)

Storage instance.

#### Implementation of

[`IAdapter`](../interfaces/IAdapter.md).[`storage`](../interfaces/IAdapter.md#storage)

## Methods

### close()

> **close**(): `Promise`\<`void`\>

Defined in: packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts:167

Close the adapter and release resources.

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IAdapter`](../interfaces/IAdapter.md).[`close`](../interfaces/IAdapter.md#close)

---

### initialize()

> **initialize**(): `Promise`\<`void`\>

Defined in: packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts:90

Initialize the adapter.

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IAdapter`](../interfaces/IAdapter.md).[`initialize`](../interfaces/IAdapter.md#initialize)
