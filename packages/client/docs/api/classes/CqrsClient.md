[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / CqrsClient

# Class: CqrsClient

CQRS Client instance returned by [createCqrsClient](../functions/createCqrsClient.md).

All fields are available immediately — the client is fully initialized at construction time.

## Constructors

### Constructor

> **new CqrsClient**(`adapter`, `cacheManager`, `commandQueue`, `queryManager`, `syncManager`, `closeResources`, `mode`): `CqrsClient`

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

#### Returns

`CqrsClient`

## Properties

### cacheManager

> `readonly` **cacheManager**: [`ICacheManager`](../interfaces/ICacheManager.md)

Cache manager for cache key lifecycle and eviction.

---

### commandQueue

> `readonly` **commandQueue**: [`ICommandQueue`](../interfaces/ICommandQueue.md)

Command queue for enqueuing and tracking commands.

---

### mode

> `readonly` **mode**: [`ExecutionMode`](../type-aliases/ExecutionMode.md)

Resolved execution mode.

---

### queryManager

> `readonly` **queryManager**: [`IQueryManager`](../interfaces/IQueryManager.md)

Query manager for reading cached data.

---

### syncManager

> `readonly` **syncManager**: [`CqrsClientSyncManager`](../interfaces/CqrsClientSyncManager.md)

Sync manager for collection sync status and manual triggers.

## Accessors

### events$

#### Get Signature

> **get** **events$**(): `Observable`\<[`LibraryEvent`](../interfaces/LibraryEvent.md)\<[`LibraryEventType`](../type-aliases/LibraryEventType.md)\>\>

Observable of all library events.

##### Returns

`Observable`\<[`LibraryEvent`](../interfaces/LibraryEvent.md)\<[`LibraryEventType`](../type-aliases/LibraryEventType.md)\>\>

---

### status

#### Get Signature

> **get** **status**(): [`AdapterStatus`](../type-aliases/AdapterStatus.md)

Current adapter status.

##### Returns

[`AdapterStatus`](../type-aliases/AdapterStatus.md)

## Methods

### close()

> **close**(): `Promise`\<`void`\>

Close the client and release all resources.
Stops sync, destroys components, and closes the adapter.

#### Returns

`Promise`\<`void`\>

---

### submit()

> **submit**\<`TPayload`, `TResponse`\>(`command`, `options?`): `Promise`\<[`SubmitResult`](../type-aliases/SubmitResult.md)\<`TResponse`\>\>

Network-aware command submission.

When online+authenticated: waits for server confirmation (like `enqueueAndWait`).
When offline/unauthenticated: returns after enqueue (like `enqueue`).

If `options.commandId` is provided, checks the queue first:

- Found + non-terminal → resumes waiting (no duplicate enqueue)
- Found + succeeded → returns cached success immediately
- Found + failed/cancelled, or not found → fresh enqueue

#### Type Parameters

##### TPayload

`TPayload`

##### TResponse

`TResponse`

#### Parameters

##### command

[`EnqueueCommand`](../interfaces/EnqueueCommand.md)\<`TPayload`\>

##### options?

[`SubmitOptions`](../interfaces/SubmitOptions.md)

#### Returns

`Promise`\<[`SubmitResult`](../type-aliases/SubmitResult.md)\<`TResponse`\>\>
