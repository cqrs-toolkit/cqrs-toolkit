[**@cqrs-toolkit/client**](../README.md)

***

[@cqrs-toolkit/client](../globals.md) / SharedWorkerAdapter

# Class: SharedWorkerAdapter

Defined in: packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts:43

SharedWorker adapter for multi-tab offline support.

This adapter:
- Connects to a SharedWorker that manages SQLite storage
- Provides a storage proxy for window-side code
- Handles window registration and heartbeats
- Restores holds after worker restarts

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

***

### mode

> `readonly` **mode**: [`ExecutionMode`](../type-aliases/ExecutionMode.md) = `'shared-worker'`

Defined in: packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts:44

## Accessors

### events$

#### Get Signature

> **get** **events$**(): `Observable`\<[`LibraryEvent`](../interfaces/LibraryEvent.md)\<[`LibraryEventType`](../type-aliases/LibraryEventType.md)\>\>

Defined in: packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts:73

##### Returns

`Observable`\<[`LibraryEvent`](../interfaces/LibraryEvent.md)\<[`LibraryEventType`](../type-aliases/LibraryEventType.md)\>\>

***

### sessionManager

#### Get Signature

> **get** **sessionManager**(): [`SessionManager`](SessionManager.md)

Defined in: packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts:77

##### Returns

[`SessionManager`](SessionManager.md)

***

### status

#### Get Signature

> **get** **status**(): [`AdapterStatus`](../type-aliases/AdapterStatus.md)

Defined in: packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts:69

##### Returns

[`AdapterStatus`](../type-aliases/AdapterStatus.md)

***

### storage

#### Get Signature

> **get** **storage**(): [`IStorage`](../interfaces/IStorage.md)

Defined in: packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts:82

##### Returns

[`IStorage`](../interfaces/IStorage.md)

## Methods

### close()

> **close**(): `Promise`\<`void`\>

Defined in: packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts:163

Close the adapter and release resources.

#### Returns

`Promise`\<`void`\>

***

### initialize()

> **initialize**(): `Promise`\<`void`\>

Defined in: packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts:90

Initialize the adapter.

#### Returns

`Promise`\<`void`\>
