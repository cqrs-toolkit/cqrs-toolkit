[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / ICommandIdMappingStore

# Interface: ICommandIdMappingStore

## Properties

### size

> `readonly` **size**: `number`

Number of mappings currently in the in-memory index.

## Methods

### deleteAll()

> **deleteAll**(): `Promise`\<`void`\>

Delete all mappings from both the in-memory index and durable storage.

#### Returns

`Promise`\<`void`\>

---

### destroy()

> **destroy**(): `Promise`\<`void`\>

Flush pending writes and release resources (stops the TTL sweep timer).

#### Returns

`Promise`\<`void`\>

---

### flush()

> **flush**(): `Promise`\<`void`\>

Force any pending writes to storage. Awaits an in-flight flush if one is
already running, then issues another if new writes arrived in the meantime.

#### Returns

`Promise`\<`void`\>

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

---

### getByServerId()

> **getByServerId**(`serverId`): `CommandIdMappingRecord` \| `undefined`

Get a mapping by server id (reverse lookup). Synchronous.

#### Parameters

##### serverId

`string`

#### Returns

`CommandIdMappingRecord` \| `undefined`

---

### getMany()

> **getMany**(`clientIds`): `Map`\<`string`, `CommandIdMappingRecord`\>

Batch variant of [get](#get): resolve many client ids in one call.
Returns a Map keyed by the queried client id; absent entries mean no
mapping exists (or the record has expired locally).

#### Parameters

##### clientIds

readonly `string`[]

#### Returns

`Map`\<`string`, `CommandIdMappingRecord`\>

---

### initialize()

> **initialize**(): `Promise`\<`void`\>

Load all non-expired mappings from storage into memory, purging expired
records in the same transaction. Must be awaited before any read or write.

#### Returns

`Promise`\<`void`\>

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

---

### saveMany()

> **saveMany**(`records`): `void`

Batch variant of [save](#save).

#### Parameters

##### records

readonly `CommandIdMappingRecord`[]

#### Returns

`void`
