[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / CommandIdMappingStore

# Class: CommandIdMappingStore\<TLink, TCommand\>

## Type Parameters

### TLink

`TLink` _extends_ `Link`

### TCommand

`TCommand` _extends_ [`EnqueueCommand`](../interfaces/EnqueueCommand.md)

## Implements

- [`ICommandIdMappingStore`](../interfaces/ICommandIdMappingStore.md)

## Constructors

### Constructor

> **new CommandIdMappingStore**\<`TLink`, `TCommand`\>(`storage`, `config?`): `CommandIdMappingStore`\<`TLink`, `TCommand`\>

#### Parameters

##### storage

[`IStorage`](../interfaces/IStorage.md)\<`TLink`, `TCommand`\>

##### config?

[`CommandIdMappingStoreConfig`](../interfaces/CommandIdMappingStoreConfig.md) = `{}`

#### Returns

`CommandIdMappingStore`\<`TLink`, `TCommand`\>

## Accessors

### size

#### Get Signature

> **get** **size**(): `number`

Number of mappings currently in the in-memory index.

##### Returns

`number`

Number of mappings currently in the in-memory index.

#### Implementation of

[`ICommandIdMappingStore`](../interfaces/ICommandIdMappingStore.md).[`size`](../interfaces/ICommandIdMappingStore.md#size)

## Methods

### deleteAll()

> **deleteAll**(): `Promise`\<`void`\>

Delete all mappings from both the in-memory index and durable storage.

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`ICommandIdMappingStore`](../interfaces/ICommandIdMappingStore.md).[`deleteAll`](../interfaces/ICommandIdMappingStore.md#deleteall)

---

### destroy()

> **destroy**(): `Promise`\<`void`\>

Flush pending writes and release resources (stops the TTL sweep timer).

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`ICommandIdMappingStore`](../interfaces/ICommandIdMappingStore.md).[`destroy`](../interfaces/ICommandIdMappingStore.md#destroy)

---

### flush()

> **flush**(): `Promise`\<`void`\>

Force any pending writes to storage. Awaits an in-flight flush if one is
already running, then issues another if new writes arrived in the meantime.

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`ICommandIdMappingStore`](../interfaces/ICommandIdMappingStore.md).[`flush`](../interfaces/ICommandIdMappingStore.md#flush)

---

### get()

> **get**(`clientId`): `CommandIdMappingRecord` \| `undefined`

Get a mapping by client id. Synchronous — reads from the in-memory index.
Returns `undefined` when no mapping exists or the record has expired locally.

#### Parameters

##### clientId

`string`

#### Returns

`CommandIdMappingRecord` \| `undefined`

#### Implementation of

[`ICommandIdMappingStore`](../interfaces/ICommandIdMappingStore.md).[`get`](../interfaces/ICommandIdMappingStore.md#get)

---

### getByServerId()

> **getByServerId**(`serverId`): `CommandIdMappingRecord` \| `undefined`

Get a mapping by server id (reverse lookup). Synchronous.

#### Parameters

##### serverId

`string`

#### Returns

`CommandIdMappingRecord` \| `undefined`

#### Implementation of

[`ICommandIdMappingStore`](../interfaces/ICommandIdMappingStore.md).[`getByServerId`](../interfaces/ICommandIdMappingStore.md#getbyserverid)

---

### getMany()

> **getMany**(`clientIds`): `Map`\<`string`, `CommandIdMappingRecord`\>

Batch variant of [get](../interfaces/ICommandIdMappingStore.md#get): resolve many client ids in one call.
Returns a Map keyed by the queried client id; absent entries mean no
mapping exists (or the record has expired locally).

#### Parameters

##### clientIds

readonly `string`[]

#### Returns

`Map`\<`string`, `CommandIdMappingRecord`\>

#### Implementation of

[`ICommandIdMappingStore`](../interfaces/ICommandIdMappingStore.md).[`getMany`](../interfaces/ICommandIdMappingStore.md#getmany)

---

### initialize()

> **initialize**(): `Promise`\<`void`\>

Load all non-expired mappings from storage into memory, purging expired
records in the same transaction. Must be awaited before any read or write.

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`ICommandIdMappingStore`](../interfaces/ICommandIdMappingStore.md).[`initialize`](../interfaces/ICommandIdMappingStore.md#initialize)

---

### save()

> **save**(`record`): `void`

Save a mapping. Mutates the in-memory index immediately and marks the
record dirty for asynchronous flush to storage. Returns once the dirty
mark has been recorded — it does NOT await the flush.

#### Parameters

##### record

`CommandIdMappingRecord`

#### Returns

`void`

#### Implementation of

[`ICommandIdMappingStore`](../interfaces/ICommandIdMappingStore.md).[`save`](../interfaces/ICommandIdMappingStore.md#save)

---

### saveMany()

> **saveMany**(`records`): `void`

Batch variant of [save](../interfaces/ICommandIdMappingStore.md#save).

#### Parameters

##### records

readonly `CommandIdMappingRecord`[]

#### Returns

`void`

#### Implementation of

[`ICommandIdMappingStore`](../interfaces/ICommandIdMappingStore.md).[`saveMany`](../interfaces/ICommandIdMappingStore.md#savemany)
