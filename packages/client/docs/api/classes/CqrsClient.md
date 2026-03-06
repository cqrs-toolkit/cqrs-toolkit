[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / CqrsClient

# Class: CqrsClient

Defined in: [packages/client/src/createCqrsClient.ts:97](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/createCqrsClient.ts#L97)

CQRS Client instance returned by [createCqrsClient](../functions/createCqrsClient.md).

All fields are available immediately — the client is fully initialized at construction time.

## Constructors

### Constructor

> **new CqrsClient**(`adapter`, `cacheManager`, `commandQueue`, `queryManager`, `syncManager`, `closeResources`, `mode`): `CqrsClient`

Defined in: [packages/client/src/createCqrsClient.ts:112](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/createCqrsClient.ts#L112)

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

Defined in: [packages/client/src/createCqrsClient.ts:99](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/createCqrsClient.ts#L99)

Cache manager for cache key lifecycle and eviction.

---

### commandQueue

> `readonly` **commandQueue**: [`ICommandQueue`](../interfaces/ICommandQueue.md)

Defined in: [packages/client/src/createCqrsClient.ts:101](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/createCqrsClient.ts#L101)

Command queue for enqueuing and tracking commands.

---

### mode

> `readonly` **mode**: [`ExecutionMode`](../type-aliases/ExecutionMode.md)

Defined in: [packages/client/src/createCqrsClient.ts:107](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/createCqrsClient.ts#L107)

Resolved execution mode.

---

### queryManager

> `readonly` **queryManager**: [`IQueryManager`](../interfaces/IQueryManager.md)

Defined in: [packages/client/src/createCqrsClient.ts:103](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/createCqrsClient.ts#L103)

Query manager for reading cached data.

---

### syncManager

> `readonly` **syncManager**: [`CqrsClientSyncManager`](../interfaces/CqrsClientSyncManager.md)

Defined in: [packages/client/src/createCqrsClient.ts:105](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/createCqrsClient.ts#L105)

Sync manager for collection sync status and manual triggers.

## Accessors

### events$

#### Get Signature

> **get** **events$**(): `Observable`\<[`LibraryEvent`](../interfaces/LibraryEvent.md)\<[`LibraryEventType`](../type-aliases/LibraryEventType.md)\>\>

Defined in: [packages/client/src/createCqrsClient.ts:245](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/createCqrsClient.ts#L245)

Observable of all library events.

##### Returns

`Observable`\<[`LibraryEvent`](../interfaces/LibraryEvent.md)\<[`LibraryEventType`](../type-aliases/LibraryEventType.md)\>\>

---

### status

#### Get Signature

> **get** **status**(): [`AdapterStatus`](../type-aliases/AdapterStatus.md)

Defined in: [packages/client/src/createCqrsClient.ts:250](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/createCqrsClient.ts#L250)

Current adapter status.

##### Returns

[`AdapterStatus`](../type-aliases/AdapterStatus.md)

## Methods

### close()

> **close**(): `Promise`\<`void`\>

Defined in: [packages/client/src/createCqrsClient.ts:258](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/createCqrsClient.ts#L258)

Close the client and release all resources.
Stops sync, destroys components, and closes the adapter.

#### Returns

`Promise`\<`void`\>

---

### submit()

> **submit**\<`TPayload`, `TResponse`\>(`command`, `options?`): `Promise`\<[`SubmitResult`](../type-aliases/SubmitResult.md)\<`TResponse`\>\>

Defined in: [packages/client/src/createCqrsClient.ts:141](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/createCqrsClient.ts#L141)

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
