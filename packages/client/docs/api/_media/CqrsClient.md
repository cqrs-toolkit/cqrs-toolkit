[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / CqrsClient

# Class: CqrsClient

Defined in: [packages/client/src/createCqrsClient.ts:90](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/createCqrsClient.ts#L90)

CQRS Client instance returned by [createCqrsClient](../functions/createCqrsClient.md).

All fields are available immediately — the client is fully initialized at construction time.

## Constructors

### Constructor

> **new CqrsClient**(`adapter`, `cacheManager`, `commandQueue`, `queryManager`, `syncManager`, `closeResources`, `mode`, `debug`): `CqrsClient`

Defined in: [packages/client/src/createCqrsClient.ts:106](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/createCqrsClient.ts#L106)

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

Defined in: [packages/client/src/createCqrsClient.ts:92](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/createCqrsClient.ts#L92)

Cache manager for cache key lifecycle and eviction.

---

### commandQueue

> `readonly` **commandQueue**: [`ICommandQueue`](../interfaces/ICommandQueue.md)

Defined in: [packages/client/src/createCqrsClient.ts:94](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/createCqrsClient.ts#L94)

Command queue for enqueuing and tracking commands.

---

### mode

> `readonly` **mode**: [`ExecutionMode`](../type-aliases/ExecutionMode.md)

Defined in: [packages/client/src/createCqrsClient.ts:100](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/createCqrsClient.ts#L100)

Resolved execution mode.

---

### queryManager

> `readonly` **queryManager**: [`IQueryManager`](../interfaces/IQueryManager.md)

Defined in: [packages/client/src/createCqrsClient.ts:96](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/createCqrsClient.ts#L96)

Query manager for reading cached data.

---

### syncManager

> `readonly` **syncManager**: [`CqrsClientSyncManager`](../interfaces/CqrsClientSyncManager.md)

Defined in: [packages/client/src/createCqrsClient.ts:98](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/createCqrsClient.ts#L98)

Sync manager for collection sync status and manual triggers.

## Accessors

### events$

#### Get Signature

> **get** **events$**(): `Observable`\<[`LibraryEvent`](../interfaces/LibraryEvent.md)\<[`LibraryEventType`](../type-aliases/LibraryEventType.md)\>\>

Defined in: [packages/client/src/createCqrsClient.ts:243](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/createCqrsClient.ts#L243)

Observable of all library events.

##### Returns

`Observable`\<[`LibraryEvent`](../interfaces/LibraryEvent.md)\<[`LibraryEventType`](../type-aliases/LibraryEventType.md)\>\>

---

### status

#### Get Signature

> **get** **status**(): [`AdapterStatus`](../type-aliases/AdapterStatus.md)

Defined in: [packages/client/src/createCqrsClient.ts:248](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/createCqrsClient.ts#L248)

Current adapter status.

##### Returns

[`AdapterStatus`](../type-aliases/AdapterStatus.md)

## Methods

### close()

> **close**(): `Promise`\<`void`\>

Defined in: [packages/client/src/createCqrsClient.ts:256](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/createCqrsClient.ts#L256)

Close the client and release all resources.
Stops sync, destroys components, and closes the adapter.

#### Returns

`Promise`\<`void`\>

---

### submit()

> **submit**\<`TPayload`, `TResponse`\>(`command`, `options?`): `Promise`\<[`SubmitResult`](../type-aliases/SubmitResult.md)\<`TResponse`\>\>

Defined in: [packages/client/src/createCqrsClient.ts:139](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/createCqrsClient.ts#L139)

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
