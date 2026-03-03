[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../README.md) / CqrsClient

# Interface: CqrsClient

Defined in: packages/client/src/createCqrsClient.ts:59

CQRS Client instance returned by [createCqrsClient](../functions/createCqrsClient.md).

## Properties

### cacheManager

> `readonly` **cacheManager**: [`CacheManager`](../classes/CacheManager.md)

Defined in: packages/client/src/createCqrsClient.ts:61

Cache manager for cache key lifecycle and eviction.

---

### commandQueue

> `readonly` **commandQueue**: [`ICommandQueue`](ICommandQueue.md)

Defined in: packages/client/src/createCqrsClient.ts:63

Command queue for enqueuing and tracking commands.

---

### events$

> `readonly` **events$**: `Observable`\<[`LibraryEvent`](LibraryEvent.md)\<[`LibraryEventType`](../type-aliases/LibraryEventType.md)\>\>

Defined in: packages/client/src/createCqrsClient.ts:71

Observable of all library events.

---

### mode

> `readonly` **mode**: [`ExecutionMode`](../type-aliases/ExecutionMode.md)

Defined in: packages/client/src/createCqrsClient.ts:73

Resolved execution mode.

---

### queryManager

> `readonly` **queryManager**: [`QueryManager`](../classes/QueryManager.md)

Defined in: packages/client/src/createCqrsClient.ts:67

Query manager for reading cached data.

---

### sessionManager

> `readonly` **sessionManager**: [`SessionManager`](../classes/SessionManager.md)

Defined in: packages/client/src/createCqrsClient.ts:69

Session manager for user identity and session lifecycle.

---

### status

> `readonly` **status**: [`AdapterStatus`](../type-aliases/AdapterStatus.md)

Defined in: packages/client/src/createCqrsClient.ts:75

Current adapter status.

---

### syncManager

> `readonly` **syncManager**: [`CqrsClientSyncManager`](CqrsClientSyncManager.md)

Defined in: packages/client/src/createCqrsClient.ts:65

Sync manager for collection sync status and manual triggers.

## Methods

### close()

> **close**(): `Promise`\<`void`\>

Defined in: packages/client/src/createCqrsClient.ts:115

Close the client and release all resources.
Stops sync, destroys components, and closes the adapter.

#### Returns

`Promise`\<`void`\>

#### Throws

Error if not initialized

---

### initialize()

> **initialize**(): `Promise`\<`void`\>

Defined in: packages/client/src/createCqrsClient.ts:107

Initialize the client.
Creates the adapter, wires all components, and starts sync.
Must be called after registering event processors.

#### Returns

`Promise`\<`void`\>

#### Throws

Error if already initialized

---

### registerProcessor()

> **registerProcessor**\<`TEvent`, `TModel`\>(`registration`): `void`

Defined in: packages/client/src/createCqrsClient.ts:96

Register an event processor before initialization.
Processors transform domain events into read model updates.

#### Type Parameters

##### TEvent

`TEvent` = `unknown`

##### TModel

`TModel` = `unknown`

#### Parameters

##### registration

[`ProcessorRegistration`](ProcessorRegistration.md)\<`TEvent`, `TModel`\>

Processor registration describing event types and handler

#### Returns

`void`

#### Example

```typescript
client.registerProcessor({
  eventTypes: 'TodoCreated',
  processor: (data, ctx) => ({
    collection: 'todos',
    id: data.id,
    update: { type: 'set', data },
    isServerUpdate: ctx.persistence !== 'Anticipated',
  }),
})
```
