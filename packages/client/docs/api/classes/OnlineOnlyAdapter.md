[**@cqrs-toolkit/client**](../README.md)

***

[@cqrs-toolkit/client](../globals.md) / OnlineOnlyAdapter

# Class: OnlineOnlyAdapter

Defined in: packages/client/src/adapters/online-only/OnlineOnlyAdapter.ts:16

Online-only adapter for development, testing, and deployments
where offline persistence is not required.

## Extends

- [`BaseAdapter`](BaseAdapter.md)

## Constructors

### Constructor

> **new OnlineOnlyAdapter**(`config`): `OnlineOnlyAdapter`

Defined in: packages/client/src/adapters/online-only/OnlineOnlyAdapter.ts:19

#### Parameters

##### config

[`ResolvedConfig`](../interfaces/ResolvedConfig.md)

#### Returns

`OnlineOnlyAdapter`

#### Overrides

[`BaseAdapter`](BaseAdapter.md).[`constructor`](BaseAdapter.md#constructor)

## Properties

### \_sessionManager

> `protected` **\_sessionManager**: [`SessionManager`](SessionManager.md) \| `undefined`

Defined in: packages/client/src/adapters/base/BaseAdapter.ts:71

#### Inherited from

[`BaseAdapter`](BaseAdapter.md).[`_sessionManager`](BaseAdapter.md#_sessionmanager)

***

### \_status

> `protected` **\_status**: [`AdapterStatus`](../type-aliases/AdapterStatus.md) = `'uninitialized'`

Defined in: packages/client/src/adapters/base/BaseAdapter.ts:72

#### Inherited from

[`BaseAdapter`](BaseAdapter.md).[`_status`](BaseAdapter.md#_status)

***

### \_storage

> `protected` **\_storage**: [`IStorage`](../interfaces/IStorage.md) \| `undefined`

Defined in: packages/client/src/adapters/base/BaseAdapter.ts:70

#### Inherited from

[`BaseAdapter`](BaseAdapter.md).[`_storage`](BaseAdapter.md#_storage)

***

### config

> `protected` `readonly` **config**: [`ResolvedConfig`](../interfaces/ResolvedConfig.md)

Defined in: packages/client/src/adapters/base/BaseAdapter.ts:68

#### Inherited from

[`BaseAdapter`](BaseAdapter.md).[`config`](BaseAdapter.md#config)

***

### eventBus

> `readonly` **eventBus**: [`EventBus`](EventBus.md)

Defined in: packages/client/src/adapters/base/BaseAdapter.ts:69

Event bus instance for wiring core components.

#### Inherited from

[`BaseAdapter`](BaseAdapter.md).[`eventBus`](BaseAdapter.md#eventbus)

***

### mode

> `readonly` **mode**: [`ExecutionMode`](../type-aliases/ExecutionMode.md) = `'online-only'`

Defined in: packages/client/src/adapters/online-only/OnlineOnlyAdapter.ts:17

Execution mode of this adapter.

#### Overrides

[`BaseAdapter`](BaseAdapter.md).[`mode`](BaseAdapter.md#mode)

## Accessors

### events$

#### Get Signature

> **get** **events$**(): `Observable`\<[`LibraryEvent`](../interfaces/LibraryEvent.md)\<[`LibraryEventType`](../type-aliases/LibraryEventType.md)\>\>

Defined in: packages/client/src/adapters/base/BaseAdapter.ts:83

Observable of library events.

##### Returns

`Observable`\<[`LibraryEvent`](../interfaces/LibraryEvent.md)\<[`LibraryEventType`](../type-aliases/LibraryEventType.md)\>\>

Observable of library events.

#### Inherited from

[`BaseAdapter`](BaseAdapter.md).[`events$`](BaseAdapter.md#events)

***

### sessionManager

#### Get Signature

> **get** **sessionManager**(): [`SessionManager`](SessionManager.md)

Defined in: packages/client/src/adapters/base/BaseAdapter.ts:87

Session manager instance.

##### Returns

[`SessionManager`](SessionManager.md)

Session manager instance.

#### Inherited from

[`BaseAdapter`](BaseAdapter.md).[`sessionManager`](BaseAdapter.md#sessionmanager)

***

### status

#### Get Signature

> **get** **status**(): [`AdapterStatus`](../type-aliases/AdapterStatus.md)

Defined in: packages/client/src/adapters/base/BaseAdapter.ts:79

Current adapter status.

##### Returns

[`AdapterStatus`](../type-aliases/AdapterStatus.md)

Current adapter status.

#### Inherited from

[`BaseAdapter`](BaseAdapter.md).[`status`](BaseAdapter.md#status)

***

### storage

#### Get Signature

> **get** **storage**(): [`IStorage`](../interfaces/IStorage.md)

Defined in: packages/client/src/adapters/base/BaseAdapter.ts:94

Storage instance.

##### Returns

[`IStorage`](../interfaces/IStorage.md)

Storage instance.

#### Inherited from

[`BaseAdapter`](BaseAdapter.md).[`storage`](BaseAdapter.md#storage)

## Methods

### close()

> **close**(): `Promise`\<`void`\>

Defined in: packages/client/src/adapters/base/BaseAdapter.ts:134

Close the adapter and release resources.

#### Returns

`Promise`\<`void`\>

#### Inherited from

[`BaseAdapter`](BaseAdapter.md).[`close`](BaseAdapter.md#close)

***

### createStorage()

> `protected` **createStorage**(): `Promise`\<[`IStorage`](../interfaces/IStorage.md)\>

Defined in: packages/client/src/adapters/online-only/OnlineOnlyAdapter.ts:23

Create the storage instance for this adapter.
Subclasses must implement this.

#### Returns

`Promise`\<[`IStorage`](../interfaces/IStorage.md)\>

#### Overrides

[`BaseAdapter`](BaseAdapter.md).[`createStorage`](BaseAdapter.md#createstorage)

***

### initialize()

> **initialize**(): `Promise`\<`void`\>

Defined in: packages/client/src/adapters/base/BaseAdapter.ts:105

Initialize the adapter.
Subclasses should call super.initialize() first.

#### Returns

`Promise`\<`void`\>

#### Inherited from

[`BaseAdapter`](BaseAdapter.md).[`initialize`](BaseAdapter.md#initialize)
