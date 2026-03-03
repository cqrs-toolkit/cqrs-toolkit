[**@cqrs-toolkit/client**](../README.md)

***

[@cqrs-toolkit/client](../globals.md) / DedicatedWorkerAdapter

# Class: DedicatedWorkerAdapter

Defined in: packages/client/src/adapters/dedicated-worker/DedicatedWorkerAdapter.ts:48

Dedicated Worker adapter for single-tab offline support.

This adapter:
- Connects to a Dedicated Worker that manages SQLite storage
- Enforces single-tab operation via tab lock
- Provides a storage proxy for window-side code

## Constructors

### Constructor

> **new DedicatedWorkerAdapter**(`config`): `DedicatedWorkerAdapter`

Defined in: packages/client/src/adapters/dedicated-worker/DedicatedWorkerAdapter.ts:63

#### Parameters

##### config

[`DedicatedWorkerAdapterConfig`](../interfaces/DedicatedWorkerAdapterConfig.md)

#### Returns

`DedicatedWorkerAdapter`

## Properties

### eventBus

> `readonly` **eventBus**: [`EventBus`](EventBus.md)

Defined in: packages/client/src/adapters/dedicated-worker/DedicatedWorkerAdapter.ts:52

***

### mode

> `readonly` **mode**: [`ExecutionMode`](../type-aliases/ExecutionMode.md) = `'dedicated-worker'`

Defined in: packages/client/src/adapters/dedicated-worker/DedicatedWorkerAdapter.ts:49

## Accessors

### events$

#### Get Signature

> **get** **events$**(): `Observable`\<[`LibraryEvent`](../interfaces/LibraryEvent.md)\<[`LibraryEventType`](../type-aliases/LibraryEventType.md)\>\>

Defined in: packages/client/src/adapters/dedicated-worker/DedicatedWorkerAdapter.ts:73

##### Returns

`Observable`\<[`LibraryEvent`](../interfaces/LibraryEvent.md)\<[`LibraryEventType`](../type-aliases/LibraryEventType.md)\>\>

***

### sessionManager

#### Get Signature

> **get** **sessionManager**(): [`SessionManager`](SessionManager.md)

Defined in: packages/client/src/adapters/dedicated-worker/DedicatedWorkerAdapter.ts:77

##### Returns

[`SessionManager`](SessionManager.md)

***

### status

#### Get Signature

> **get** **status**(): [`AdapterStatus`](../type-aliases/AdapterStatus.md)

Defined in: packages/client/src/adapters/dedicated-worker/DedicatedWorkerAdapter.ts:69

##### Returns

[`AdapterStatus`](../type-aliases/AdapterStatus.md)

***

### storage

#### Get Signature

> **get** **storage**(): [`IStorage`](../interfaces/IStorage.md)

Defined in: packages/client/src/adapters/dedicated-worker/DedicatedWorkerAdapter.ts:82

##### Returns

[`IStorage`](../interfaces/IStorage.md)

## Methods

### close()

> **close**(): `Promise`\<`void`\>

Defined in: packages/client/src/adapters/dedicated-worker/DedicatedWorkerAdapter.ts:166

Close the adapter and release resources.

#### Returns

`Promise`\<`void`\>

***

### initialize()

> **initialize**(): `Promise`\<`void`\>

Defined in: packages/client/src/adapters/dedicated-worker/DedicatedWorkerAdapter.ts:92

Initialize the adapter.

#### Returns

`Promise`\<`void`\>

#### Throws

TabLockError if another tab already has the lock
