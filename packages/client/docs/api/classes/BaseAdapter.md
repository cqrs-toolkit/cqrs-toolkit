[**@cqrs-toolkit/client**](../README.md)

***

[@cqrs-toolkit/client](../globals.md) / BaseAdapter

# Abstract Class: BaseAdapter

Defined in: packages/client/src/adapters/base/BaseAdapter.ts:65

Base adapter with shared functionality.

## Extended by

- [`OnlineOnlyAdapter`](OnlineOnlyAdapter.md)

## Implements

- [`IAdapter`](../interfaces/IAdapter.md)

## Constructors

### Constructor

> **new BaseAdapter**(`config`): `BaseAdapter`

Defined in: packages/client/src/adapters/base/BaseAdapter.ts:74

#### Parameters

##### config

[`ResolvedConfig`](../interfaces/ResolvedConfig.md)

#### Returns

`BaseAdapter`

## Properties

### \_sessionManager

> `protected` **\_sessionManager**: [`SessionManager`](SessionManager.md) \| `null` = `null`

Defined in: packages/client/src/adapters/base/BaseAdapter.ts:71

***

### \_status

> `protected` **\_status**: [`AdapterStatus`](../type-aliases/AdapterStatus.md) = `'uninitialized'`

Defined in: packages/client/src/adapters/base/BaseAdapter.ts:72

***

### \_storage

> `protected` **\_storage**: [`IStorage`](../interfaces/IStorage.md) \| `null` = `null`

Defined in: packages/client/src/adapters/base/BaseAdapter.ts:70

***

### config

> `protected` `readonly` **config**: [`ResolvedConfig`](../interfaces/ResolvedConfig.md)

Defined in: packages/client/src/adapters/base/BaseAdapter.ts:68

***

### eventBus

> `readonly` **eventBus**: [`EventBus`](EventBus.md)

Defined in: packages/client/src/adapters/base/BaseAdapter.ts:69

Event bus instance for wiring core components.

#### Implementation of

[`IAdapter`](../interfaces/IAdapter.md).[`eventBus`](../interfaces/IAdapter.md#eventbus)

***

### mode

> `abstract` `readonly` **mode**: [`ExecutionMode`](../type-aliases/ExecutionMode.md)

Defined in: packages/client/src/adapters/base/BaseAdapter.ts:66

Execution mode of this adapter.

#### Implementation of

[`IAdapter`](../interfaces/IAdapter.md).[`mode`](../interfaces/IAdapter.md#mode)

## Accessors

### events$

#### Get Signature

> **get** **events$**(): `Observable`\<[`LibraryEvent`](../interfaces/LibraryEvent.md)\<[`LibraryEventType`](../type-aliases/LibraryEventType.md)\>\>

Defined in: packages/client/src/adapters/base/BaseAdapter.ts:83

Observable of library events.

##### Returns

`Observable`\<[`LibraryEvent`](../interfaces/LibraryEvent.md)\<[`LibraryEventType`](../type-aliases/LibraryEventType.md)\>\>

Observable of library events.

#### Implementation of

[`IAdapter`](../interfaces/IAdapter.md).[`events$`](../interfaces/IAdapter.md#events)

***

### sessionManager

#### Get Signature

> **get** **sessionManager**(): [`SessionManager`](SessionManager.md)

Defined in: packages/client/src/adapters/base/BaseAdapter.ts:87

Session manager instance.

##### Returns

[`SessionManager`](SessionManager.md)

Session manager instance.

#### Implementation of

[`IAdapter`](../interfaces/IAdapter.md).[`sessionManager`](../interfaces/IAdapter.md#sessionmanager)

***

### status

#### Get Signature

> **get** **status**(): [`AdapterStatus`](../type-aliases/AdapterStatus.md)

Defined in: packages/client/src/adapters/base/BaseAdapter.ts:79

Current adapter status.

##### Returns

[`AdapterStatus`](../type-aliases/AdapterStatus.md)

Current adapter status.

#### Implementation of

[`IAdapter`](../interfaces/IAdapter.md).[`status`](../interfaces/IAdapter.md#status)

***

### storage

#### Get Signature

> **get** **storage**(): [`IStorage`](../interfaces/IStorage.md)

Defined in: packages/client/src/adapters/base/BaseAdapter.ts:94

Storage instance.

##### Returns

[`IStorage`](../interfaces/IStorage.md)

Storage instance.

#### Implementation of

[`IAdapter`](../interfaces/IAdapter.md).[`storage`](../interfaces/IAdapter.md#storage)

## Methods

### close()

> **close**(): `Promise`\<`void`\>

Defined in: packages/client/src/adapters/base/BaseAdapter.ts:134

Close the adapter and release resources.

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IAdapter`](../interfaces/IAdapter.md).[`close`](../interfaces/IAdapter.md#close)

***

### createStorage()

> `abstract` `protected` **createStorage**(): `Promise`\<[`IStorage`](../interfaces/IStorage.md)\>

Defined in: packages/client/src/adapters/base/BaseAdapter.ts:151

Create the storage instance for this adapter.
Subclasses must implement this.

#### Returns

`Promise`\<[`IStorage`](../interfaces/IStorage.md)\>

***

### initialize()

> **initialize**(): `Promise`\<`void`\>

Defined in: packages/client/src/adapters/base/BaseAdapter.ts:105

Initialize the adapter.
Subclasses should call super.initialize() first.

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IAdapter`](../interfaces/IAdapter.md).[`initialize`](../interfaces/IAdapter.md#initialize)
