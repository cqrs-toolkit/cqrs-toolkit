[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / CqrsClient

# Class: CqrsClient

Defined in: packages/client/src/createCqrsClient.ts:81

CQRS Client instance returned by [createCqrsClient](../functions/createCqrsClient.md).

All fields are available immediately — the client is fully initialized at construction time.

## Constructors

### Constructor

> **new CqrsClient**(`adapter`, `cacheManager`, `commandQueue`, `queryManager`, `syncManager`, `closeResources`, `mode`, `debug`): `CqrsClient`

Defined in: packages/client/src/createCqrsClient.ts:97

#### Parameters

##### adapter

[`IAdapter`](../type-aliases/IAdapter.md)

##### cacheManager

[`ICacheManager`](../interfaces/ICacheManager.md)

##### commandQueue

[`ICommandQueue`](../interfaces/ICommandQueue.md)

##### queryManager

[`IQueryManager`](../interfaces/IQueryManager.md)

##### syncManager

[`CqrsClientSyncManager`](../interfaces/CqrsClientSyncManager.md)

##### closeResources

() => `Promise`\<`void`\>

##### mode

[`ExecutionMode`](../type-aliases/ExecutionMode.md)

##### debug

`boolean`

#### Returns

`CqrsClient`

## Properties

### cacheManager

> `readonly` **cacheManager**: [`ICacheManager`](../interfaces/ICacheManager.md)

Defined in: packages/client/src/createCqrsClient.ts:83

Cache manager for cache key lifecycle and eviction.

---

### commandQueue

> `readonly` **commandQueue**: [`ICommandQueue`](../interfaces/ICommandQueue.md)

Defined in: packages/client/src/createCqrsClient.ts:85

Command queue for enqueuing and tracking commands.

---

### mode

> `readonly` **mode**: [`ExecutionMode`](../type-aliases/ExecutionMode.md)

Defined in: packages/client/src/createCqrsClient.ts:91

Resolved execution mode.

---

### queryManager

> `readonly` **queryManager**: [`IQueryManager`](../interfaces/IQueryManager.md)

Defined in: packages/client/src/createCqrsClient.ts:87

Query manager for reading cached data.

---

### syncManager

> `readonly` **syncManager**: [`CqrsClientSyncManager`](../interfaces/CqrsClientSyncManager.md)

Defined in: packages/client/src/createCqrsClient.ts:89

Sync manager for collection sync status and manual triggers.

## Accessors

### events$

#### Get Signature

> **get** **events$**(): `Observable`\<[`LibraryEvent`](../interfaces/LibraryEvent.md)\<[`LibraryEventType`](../type-aliases/LibraryEventType.md)\>\>

Defined in: packages/client/src/createCqrsClient.ts:120

Observable of all library events.

##### Returns

`Observable`\<[`LibraryEvent`](../interfaces/LibraryEvent.md)\<[`LibraryEventType`](../type-aliases/LibraryEventType.md)\>\>

---

### status

#### Get Signature

> **get** **status**(): [`AdapterStatus`](../type-aliases/AdapterStatus.md)

Defined in: packages/client/src/createCqrsClient.ts:125

Current adapter status.

##### Returns

[`AdapterStatus`](../type-aliases/AdapterStatus.md)

## Methods

### close()

> **close**(): `Promise`\<`void`\>

Defined in: packages/client/src/createCqrsClient.ts:133

Close the client and release all resources.
Stops sync, destroys components, and closes the adapter.

#### Returns

`Promise`\<`void`\>
