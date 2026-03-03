[**@cqrs-toolkit/client**](../README.md)

***

[@cqrs-toolkit/client](../globals.md) / IAdapter

# Interface: IAdapter

Defined in: packages/client/src/adapters/base/BaseAdapter.ts:20

Base adapter interface that all mode adapters must implement.

## Properties

### eventBus

> `readonly` **eventBus**: [`EventBus`](../classes/EventBus.md)

Defined in: packages/client/src/adapters/base/BaseAdapter.ts:39

Event bus instance for wiring core components.

***

### events$

> `readonly` **events$**: `Observable`\<[`LibraryEvent`](LibraryEvent.md)\<[`LibraryEventType`](../type-aliases/LibraryEventType.md)\>\>

Defined in: packages/client/src/adapters/base/BaseAdapter.ts:34

Observable of library events.

***

### mode

> `readonly` **mode**: [`ExecutionMode`](../type-aliases/ExecutionMode.md)

Defined in: packages/client/src/adapters/base/BaseAdapter.ts:24

Execution mode of this adapter.

***

### sessionManager

> `readonly` **sessionManager**: [`SessionManager`](../classes/SessionManager.md)

Defined in: packages/client/src/adapters/base/BaseAdapter.ts:44

Session manager instance.

***

### status

> `readonly` **status**: [`AdapterStatus`](../type-aliases/AdapterStatus.md)

Defined in: packages/client/src/adapters/base/BaseAdapter.ts:29

Current adapter status.

***

### storage

> `readonly` **storage**: [`IStorage`](IStorage.md)

Defined in: packages/client/src/adapters/base/BaseAdapter.ts:49

Storage instance.

## Methods

### close()

> **close**(): `Promise`\<`void`\>

Defined in: packages/client/src/adapters/base/BaseAdapter.ts:59

Close the adapter and release resources.

#### Returns

`Promise`\<`void`\>

***

### initialize()

> **initialize**(): `Promise`\<`void`\>

Defined in: packages/client/src/adapters/base/BaseAdapter.ts:54

Initialize the adapter.

#### Returns

`Promise`\<`void`\>
