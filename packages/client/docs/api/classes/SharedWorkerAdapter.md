[**@cqrs-toolkit/client**](../README.md)

***

[@cqrs-toolkit/client](../globals.md) / SharedWorkerAdapter

# Class: SharedWorkerAdapter

Defined in: packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts:42

SharedWorker adapter for multi-tab offline support.

This adapter:
- Connects to a SharedWorker that manages SQLite storage
- Provides a storage proxy for window-side code
- Handles window registration and heartbeats
- Restores holds after worker restarts

## Constructors

### Constructor

> **new SharedWorkerAdapter**(`config`): `SharedWorkerAdapter`

Defined in: packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts:62

#### Parameters

##### config

[`SharedWorkerAdapterConfig`](../interfaces/SharedWorkerAdapterConfig.md)

#### Returns

`SharedWorkerAdapter`

## Properties

### eventBus

> `readonly` **eventBus**: [`EventBus`](EventBus.md)

Defined in: packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts:46

***

### mode

> `readonly` **mode**: [`ExecutionMode`](../type-aliases/ExecutionMode.md) = `'shared-worker'`

Defined in: packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts:43

## Accessors

### events$

#### Get Signature

> **get** **events$**(): `Observable`\<[`LibraryEvent`](../interfaces/LibraryEvent.md)\<[`LibraryEventType`](../type-aliases/LibraryEventType.md)\>\>

Defined in: packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts:72

##### Returns

`Observable`\<[`LibraryEvent`](../interfaces/LibraryEvent.md)\<[`LibraryEventType`](../type-aliases/LibraryEventType.md)\>\>

***

### sessionManager

#### Get Signature

> **get** **sessionManager**(): [`SessionManager`](SessionManager.md)

Defined in: packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts:76

##### Returns

[`SessionManager`](SessionManager.md)

***

### status

#### Get Signature

> **get** **status**(): [`AdapterStatus`](../type-aliases/AdapterStatus.md)

Defined in: packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts:68

##### Returns

[`AdapterStatus`](../type-aliases/AdapterStatus.md)

***

### storage

#### Get Signature

> **get** **storage**(): [`IStorage`](../interfaces/IStorage.md)

Defined in: packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts:83

##### Returns

[`IStorage`](../interfaces/IStorage.md)

## Methods

### close()

> **close**(): `Promise`\<`void`\>

Defined in: packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts:168

Close the adapter and release resources.

#### Returns

`Promise`\<`void`\>

***

### initialize()

> **initialize**(): `Promise`\<`void`\>

Defined in: packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts:93

Initialize the adapter.

#### Returns

`Promise`\<`void`\>

***

### trackHold()

> **trackHold**(`cacheKey`): `void`

Defined in: packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts:213

Track a local hold for restoration after worker restart.

#### Parameters

##### cacheKey

`string`

Cache key being held

#### Returns

`void`

***

### untrackHold()

> **untrackHold**(`cacheKey`): `void`

Defined in: packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts:222

Remove a local hold tracking.

#### Parameters

##### cacheKey

`string`

Cache key being released

#### Returns

`void`
