[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / DedicatedWorkerAdapter

# Class: DedicatedWorkerAdapter

Defined in: packages/client/src/adapters/dedicated-worker/DedicatedWorkerAdapter.ts:48

Dedicated Worker adapter for single-tab offline support.

This adapter:

- Connects to a Dedicated Worker that manages SQLite storage
- Enforces single-tab operation via tab lock
- Provides a storage proxy for window-side code

## Implements

- [`IAdapter`](../interfaces/IAdapter.md)

## Constructors

### Constructor

> **new DedicatedWorkerAdapter**(`config`): `DedicatedWorkerAdapter`

Defined in: packages/client/src/adapters/dedicated-worker/DedicatedWorkerAdapter.ts:64

#### Parameters

##### config

[`DedicatedWorkerAdapterConfig`](../interfaces/DedicatedWorkerAdapterConfig.md)

#### Returns

`DedicatedWorkerAdapter`

## Properties

### eventBus

> `readonly` **eventBus**: [`EventBus`](EventBus.md)

Defined in: packages/client/src/adapters/dedicated-worker/DedicatedWorkerAdapter.ts:52

Event bus instance for wiring core components.

#### Implementation of

[`IAdapter`](../interfaces/IAdapter.md).[`eventBus`](../interfaces/IAdapter.md#eventbus)

---

### mode

> `readonly` **mode**: [`ExecutionMode`](../type-aliases/ExecutionMode.md) = `'dedicated-worker'`

Defined in: packages/client/src/adapters/dedicated-worker/DedicatedWorkerAdapter.ts:49

Execution mode of this adapter.

#### Implementation of

[`IAdapter`](../interfaces/IAdapter.md).[`mode`](../interfaces/IAdapter.md#mode)

## Accessors

### events$

#### Get Signature

> **get** **events$**(): `Observable`\<[`LibraryEvent`](../interfaces/LibraryEvent.md)\<[`LibraryEventType`](../type-aliases/LibraryEventType.md)\>\>

Defined in: packages/client/src/adapters/dedicated-worker/DedicatedWorkerAdapter.ts:74

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

Defined in: packages/client/src/adapters/dedicated-worker/DedicatedWorkerAdapter.ts:78

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

Defined in: packages/client/src/adapters/dedicated-worker/DedicatedWorkerAdapter.ts:70

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

Defined in: packages/client/src/adapters/dedicated-worker/DedicatedWorkerAdapter.ts:83

Storage instance.

##### Returns

[`IStorage`](../interfaces/IStorage.md)

Storage instance.

#### Implementation of

[`IAdapter`](../interfaces/IAdapter.md).[`storage`](../interfaces/IAdapter.md#storage)

## Methods

### close()

> **close**(): `Promise`\<`void`\>

Defined in: packages/client/src/adapters/dedicated-worker/DedicatedWorkerAdapter.ts:167

Close the adapter and release resources.

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IAdapter`](../interfaces/IAdapter.md).[`close`](../interfaces/IAdapter.md#close)

---

### initialize()

> **initialize**(): `Promise`\<`void`\>

Defined in: packages/client/src/adapters/dedicated-worker/DedicatedWorkerAdapter.ts:93

Initialize the adapter.

#### Returns

`Promise`\<`void`\>

#### Throws

TabLockError if another tab already has the lock

#### Implementation of

[`IAdapter`](../interfaces/IAdapter.md).[`initialize`](../interfaces/IAdapter.md#initialize)
