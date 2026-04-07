[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / CqrsClient

# Class: CqrsClient\<TLink, TCommand\>

CQRS Client instance returned by [createCqrsClient](../functions/createCqrsClient.md).

All fields are available immediately — the client is fully initialized at construction time.

## Type Parameters

### TLink

`TLink` _extends_ `Link`

### TCommand

`TCommand` _extends_ [`EnqueueCommand`](../interfaces/EnqueueCommand.md)

## Constructors

### Constructor

> **new CqrsClient**\<`TLink`, `TCommand`\>(`adapter`, `cacheManager`, `commandQueue`, `queryManager`, `syncManager`, `closeResources`, `mode`): `CqrsClient`\<`TLink`, `TCommand`\>

#### Parameters

##### adapter

[`IAdapter`](../type-aliases/IAdapter.md)\<`TLink`, `TCommand`\>

##### cacheManager

[`ICacheManager`](../interfaces/ICacheManager.md)\<`TLink`\>

##### commandQueue

[`ICommandQueue`](../interfaces/ICommandQueue.md)\<`TLink`, `TCommand`\>

##### queryManager

[`IQueryManager`](../interfaces/IQueryManager.md)\<`TLink`\>

##### syncManager

[`CqrsClientSyncManager`](../interfaces/CqrsClientSyncManager.md)\<`TLink`\>

##### closeResources

() => `Promise`\<`void`\>

##### mode

`string`

#### Returns

`CqrsClient`\<`TLink`, `TCommand`\>

## Properties

### cacheManager

> `readonly` **cacheManager**: [`ICacheManager`](../interfaces/ICacheManager.md)\<`TLink`\>

Cache manager for cache key lifecycle and eviction.

---

### commandQueue

> `readonly` **commandQueue**: [`ICommandQueue`](../interfaces/ICommandQueue.md)\<`TLink`, `TCommand`\>

Command queue for enqueuing and tracking commands.

---

### mode

> `readonly` **mode**: `string`

Resolved execution mode.

---

### queryManager

> `readonly` **queryManager**: [`IQueryManager`](../interfaces/IQueryManager.md)\<`TLink`\>

Query manager for reading cached data.

---

### syncManager

> `readonly` **syncManager**: [`CqrsClientSyncManager`](../interfaces/CqrsClientSyncManager.md)\<`TLink`\>

Sync manager for collection sync status and manual triggers.

## Accessors

### events$

#### Get Signature

> **get** **events$**(): `Observable`\<[`LibraryEvent`](../interfaces/LibraryEvent.md)\<`TLink`, [`LibraryEventType`](../type-aliases/LibraryEventType.md)\>\>

Observable of all library events.

##### Returns

`Observable`\<[`LibraryEvent`](../interfaces/LibraryEvent.md)\<`TLink`, [`LibraryEventType`](../type-aliases/LibraryEventType.md)\>\>

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

### getCommandEntities()

> **getCommandEntities**(`commandId`, `collection?`): `Promise`\<`string`[]\>

Get entity IDs that were created or updated by a command's anticipated events.

#### Parameters

##### commandId

`string`

The command ID (from SubmitSuccess.commandId)

##### collection?

`string`

Optional collection filter. When provided, only returns
entities from that collection.

#### Returns

`Promise`\<`string`[]\>

Array of entity IDs. Empty if the command has no tracked entries
(e.g., already reached terminal state and was cleaned up).

---

### seed()

> **seed**(`cacheKey`): `Promise`\<`void`\>

Seed all collections whose keyTypes match the given cache key identity.
Acquires the cache key if needed and waits for all matching collections to settle.

- If already seeded, returns immediately.
- If unseeded, acquires the cache key (which triggers seeding via events) then waits.
- If seeding is in progress, waits for settlement.
- If settlement fails, throws with collection-level error details.

#### Parameters

##### cacheKey

[`CacheKeyIdentity`](../type-aliases/CacheKeyIdentity.md)\<`TLink`\>

Cache key identity to seed for

#### Returns

`Promise`\<`void`\>

---

### submit()

> **submit**\<`TResponse`\>(`params`): `Promise`\<[`SubmitResult`](../type-aliases/SubmitResult.md)\<`TResponse`\>\>

Network-aware command submission.

When online+authenticated: waits for server confirmation (like `enqueueAndWait`).
When offline/unauthenticated: returns after enqueue (like `enqueue`).

If `options.commandId` is provided, checks the queue first:

- Found + non-terminal → resumes waiting (no duplicate enqueue)
- Found + succeeded → returns cached success immediately
- Found + failed/cancelled, or not found → fresh enqueue

#### Type Parameters

##### TResponse

`TResponse` = `unknown`

#### Parameters

##### params

[`SubmitParams`](../interfaces/SubmitParams.md)\<`TLink`, `TCommand`\>

#### Returns

`Promise`\<[`SubmitResult`](../type-aliases/SubmitResult.md)\<`TResponse`\>\>
