[**@cqrs-toolkit/client**](../README.md)

***

[@cqrs-toolkit/client](../globals.md) / CqrsClient

# Class: CqrsClient

Defined in: packages/client/src/createCqrsClient.ts:63

CQRS Client instance returned by [createCqrsClient](../functions/createCqrsClient.md).

All fields are available immediately — the client is fully initialized at construction time.

## Constructors

### Constructor

> **new CqrsClient**(`adapter`, `cacheManager`, `commandQueue`, `syncManager`, `queryManager`, `eventCache`, `readModelStore`, `eventProcessorRunner`, `mode`): `CqrsClient`

Defined in: packages/client/src/createCqrsClient.ts:80

#### Parameters

##### adapter

[`IAdapter`](../interfaces/IAdapter.md)

##### cacheManager

[`CacheManager`](CacheManager.md)

##### commandQueue

[`CommandQueue`](CommandQueue.md)

##### syncManager

[`SyncManager`](SyncManager.md)

##### queryManager

[`QueryManager`](QueryManager.md)

##### eventCache

[`EventCache`](EventCache.md)

##### readModelStore

[`ReadModelStore`](ReadModelStore.md)

##### eventProcessorRunner

[`EventProcessorRunner`](EventProcessorRunner.md)

##### mode

[`ExecutionMode`](../type-aliases/ExecutionMode.md)

#### Returns

`CqrsClient`

## Properties

### cacheManager

> `readonly` **cacheManager**: [`CacheManager`](CacheManager.md)

Defined in: packages/client/src/createCqrsClient.ts:65

Cache manager for cache key lifecycle and eviction.

***

### commandQueue

> `readonly` **commandQueue**: [`ICommandQueue`](../interfaces/ICommandQueue.md)

Defined in: packages/client/src/createCqrsClient.ts:67

Command queue for enqueuing and tracking commands.

***

### mode

> `readonly` **mode**: [`ExecutionMode`](../type-aliases/ExecutionMode.md)

Defined in: packages/client/src/createCqrsClient.ts:71

Resolved execution mode.

***

### queryManager

> `readonly` **queryManager**: [`QueryManager`](QueryManager.md)

Defined in: packages/client/src/createCqrsClient.ts:69

Query manager for reading cached data.

## Accessors

### events$

#### Get Signature

> **get** **events$**(): `Observable`\<[`LibraryEvent`](../interfaces/LibraryEvent.md)\<[`LibraryEventType`](../type-aliases/LibraryEventType.md)\>\>

Defined in: packages/client/src/createCqrsClient.ts:122

Observable of all library events.

##### Returns

`Observable`\<[`LibraryEvent`](../interfaces/LibraryEvent.md)\<[`LibraryEventType`](../type-aliases/LibraryEventType.md)\>\>

***

### sessionManager

#### Get Signature

> **get** **sessionManager**(): [`SessionManager`](SessionManager.md)

Defined in: packages/client/src/createCqrsClient.ts:117

Session manager for user identity and session lifecycle.

##### Returns

[`SessionManager`](SessionManager.md)

***

### status

#### Get Signature

> **get** **status**(): [`AdapterStatus`](../type-aliases/AdapterStatus.md)

Defined in: packages/client/src/createCqrsClient.ts:127

Current adapter status.

##### Returns

[`AdapterStatus`](../type-aliases/AdapterStatus.md)

***

### syncManager

#### Get Signature

> **get** **syncManager**(): [`CqrsClientSyncManager`](../interfaces/CqrsClientSyncManager.md)

Defined in: packages/client/src/createCqrsClient.ts:104

Sync manager for collection sync status and manual triggers.

##### Returns

[`CqrsClientSyncManager`](../interfaces/CqrsClientSyncManager.md)

## Methods

### close()

> **close**(): `Promise`\<`void`\>

Defined in: packages/client/src/createCqrsClient.ts:135

Close the client and release all resources.
Stops sync, destroys components, and closes the adapter.

#### Returns

`Promise`\<`void`\>
