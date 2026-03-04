[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / MainThreadAdapter

# Class: MainThreadAdapter

Defined in: packages/client/src/adapters/main-thread/MainThreadAdapter.ts:38

Main Thread adapter for single-tab offline support without workers.

This adapter:

- Runs SQLite WASM directly in the main thread
- Uses opfs-sahpool VFS for async-safe access
- Enforces single-tab operation via Web Locks API or BroadcastChannel

## Implements

- [`IAdapter`](../interfaces/IAdapter.md)

## Constructors

### Constructor

> **new MainThreadAdapter**(`config`): `MainThreadAdapter`

Defined in: packages/client/src/adapters/main-thread/MainThreadAdapter.ts:53

#### Parameters

##### config

[`ResolvedConfig`](../interfaces/ResolvedConfig.md)

#### Returns

`MainThreadAdapter`

## Properties

### eventBus

> `readonly` **eventBus**: [`EventBus`](EventBus.md)

Defined in: packages/client/src/adapters/main-thread/MainThreadAdapter.ts:42

Event bus instance for wiring core components.

#### Implementation of

[`IAdapter`](../interfaces/IAdapter.md).[`eventBus`](../interfaces/IAdapter.md#eventbus)

---

### mode

> `readonly` **mode**: [`ExecutionMode`](../type-aliases/ExecutionMode.md) = `'main-thread'`

Defined in: packages/client/src/adapters/main-thread/MainThreadAdapter.ts:39

Execution mode of this adapter.

#### Implementation of

[`IAdapter`](../interfaces/IAdapter.md).[`mode`](../interfaces/IAdapter.md#mode)

## Accessors

### events$

#### Get Signature

> **get** **events$**(): `Observable`\<[`LibraryEvent`](../interfaces/LibraryEvent.md)\<[`LibraryEventType`](../type-aliases/LibraryEventType.md)\>\>

Defined in: packages/client/src/adapters/main-thread/MainThreadAdapter.ts:63

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

Defined in: packages/client/src/adapters/main-thread/MainThreadAdapter.ts:67

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

Defined in: packages/client/src/adapters/main-thread/MainThreadAdapter.ts:59

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

Defined in: packages/client/src/adapters/main-thread/MainThreadAdapter.ts:72

Storage instance.

##### Returns

[`IStorage`](../interfaces/IStorage.md)

Storage instance.

#### Implementation of

[`IAdapter`](../interfaces/IAdapter.md).[`storage`](../interfaces/IAdapter.md#storage)

## Methods

### close()

> **close**(): `Promise`\<`void`\>

Defined in: packages/client/src/adapters/main-thread/MainThreadAdapter.ts:124

Close the adapter and release resources.

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IAdapter`](../interfaces/IAdapter.md).[`close`](../interfaces/IAdapter.md#close)

---

### initialize()

> **initialize**(): `Promise`\<`void`\>

Defined in: packages/client/src/adapters/main-thread/MainThreadAdapter.ts:82

Initialize the adapter.

#### Returns

`Promise`\<`void`\>

#### Throws

TabLockError if another tab already has the lock

#### Implementation of

[`IAdapter`](../interfaces/IAdapter.md).[`initialize`](../interfaces/IAdapter.md#initialize)
