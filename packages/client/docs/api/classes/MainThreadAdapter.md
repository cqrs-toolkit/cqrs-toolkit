[**@cqrs-toolkit/client**](../README.md)

***

[@cqrs-toolkit/client](../globals.md) / MainThreadAdapter

# Class: MainThreadAdapter

Defined in: packages/client/src/adapters/main-thread/MainThreadAdapter.ts:38

Main Thread adapter for single-tab offline support without workers.

This adapter:
- Runs SQLite WASM directly in the main thread
- Uses opfs-sahpool VFS for async-safe access
- Enforces single-tab operation via Web Locks API or BroadcastChannel

## Constructors

### Constructor

> **new MainThreadAdapter**(`config`): `MainThreadAdapter`

Defined in: packages/client/src/adapters/main-thread/MainThreadAdapter.ts:52

#### Parameters

##### config

[`ResolvedConfig`](../interfaces/ResolvedConfig.md)

#### Returns

`MainThreadAdapter`

## Properties

### eventBus

> `readonly` **eventBus**: [`EventBus`](EventBus.md)

Defined in: packages/client/src/adapters/main-thread/MainThreadAdapter.ts:42

***

### mode

> `readonly` **mode**: [`ExecutionMode`](../type-aliases/ExecutionMode.md) = `'main-thread'`

Defined in: packages/client/src/adapters/main-thread/MainThreadAdapter.ts:39

## Accessors

### events$

#### Get Signature

> **get** **events$**(): `Observable`\<[`LibraryEvent`](../interfaces/LibraryEvent.md)\<[`LibraryEventType`](../type-aliases/LibraryEventType.md)\>\>

Defined in: packages/client/src/adapters/main-thread/MainThreadAdapter.ts:62

##### Returns

`Observable`\<[`LibraryEvent`](../interfaces/LibraryEvent.md)\<[`LibraryEventType`](../type-aliases/LibraryEventType.md)\>\>

***

### sessionManager

#### Get Signature

> **get** **sessionManager**(): [`SessionManager`](SessionManager.md)

Defined in: packages/client/src/adapters/main-thread/MainThreadAdapter.ts:66

##### Returns

[`SessionManager`](SessionManager.md)

***

### status

#### Get Signature

> **get** **status**(): [`AdapterStatus`](../type-aliases/AdapterStatus.md)

Defined in: packages/client/src/adapters/main-thread/MainThreadAdapter.ts:58

##### Returns

[`AdapterStatus`](../type-aliases/AdapterStatus.md)

***

### storage

#### Get Signature

> **get** **storage**(): [`IStorage`](../interfaces/IStorage.md)

Defined in: packages/client/src/adapters/main-thread/MainThreadAdapter.ts:71

##### Returns

[`IStorage`](../interfaces/IStorage.md)

## Methods

### close()

> **close**(): `Promise`\<`void`\>

Defined in: packages/client/src/adapters/main-thread/MainThreadAdapter.ts:123

Close the adapter and release resources.

#### Returns

`Promise`\<`void`\>

***

### initialize()

> **initialize**(): `Promise`\<`void`\>

Defined in: packages/client/src/adapters/main-thread/MainThreadAdapter.ts:81

Initialize the adapter.

#### Returns

`Promise`\<`void`\>

#### Throws

TabLockError if another tab already has the lock
