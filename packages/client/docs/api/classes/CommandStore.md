[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / CommandStore

# Class: CommandStore\<TLink, TCommand\>

## Type Parameters

### TLink

`TLink` _extends_ `Link`

### TCommand

`TCommand` _extends_ [`EnqueueCommand`](../interfaces/EnqueueCommand.md)

## Implements

- [`ICommandStore`](../interfaces/ICommandStore.md)\<`TLink`, `TCommand`\>

## Constructors

### Constructor

> **new CommandStore**\<`TLink`, `TCommand`\>(`storage`, `config?`): `CommandStore`\<`TLink`, `TCommand`\>

#### Parameters

##### storage

[`IStorage`](../interfaces/IStorage.md)\<`TLink`, `TCommand`\>

##### config?

[`CommandStoreConfig`](../interfaces/CommandStoreConfig.md) = `{}`

#### Returns

`CommandStore`\<`TLink`, `TCommand`\>

## Properties

### retainTerminal

> `readonly` **retainTerminal**: `boolean`

## Methods

### batchUpdate()

> **batchUpdate**(`updates`): `number`

Batch update commands. Mutates in-memory references, marks dirty.
Returns the count of commands that were found and updated.

#### Parameters

##### updates

readonly `BatchUpdateEntry`\<`TLink`, `TCommand`\>[]

#### Returns

`number`

#### Implementation of

[`ICommandStore`](../interfaces/ICommandStore.md).[`batchUpdate`](../interfaces/ICommandStore.md#batchupdate)

---

### delete()

> **delete**(`commandId`): `void`

Delete a command. Removes from memory, schedules storage delete via flush queue.

#### Parameters

##### commandId

`string`

#### Returns

`void`

#### Implementation of

[`ICommandStore`](../interfaces/ICommandStore.md).[`delete`](../interfaces/ICommandStore.md#delete)

---

### deleteAll()

> **deleteAll**(): `Promise`\<`void`\>

Delete all commands. Clears memory, delegates to storage.

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`ICommandStore`](../interfaces/ICommandStore.md).[`deleteAll`](../interfaces/ICommandStore.md#deleteall)

---

### destroy()

> **destroy**(): `Promise`\<`void`\>

Destroy — flush remaining changes and release resources.

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`ICommandStore`](../interfaces/ICommandStore.md).[`destroy`](../interfaces/ICommandStore.md#destroy)

---

### flush()

> **flush**(): `Promise`\<`void`\>

Flush all pending changes to storage. Awaits in-flight flush if any.

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`ICommandStore`](../interfaces/ICommandStore.md).[`flush`](../interfaces/ICommandStore.md#flush)

---

### get()

> **get**(`commandId`): `Promise`\<[`CommandRecord`](../interfaces/CommandRecord.md)\<`TLink`, `TCommand`, `unknown`\> \| `undefined`\>

Get a command by ID. Returns in-memory reference if present, falls through to storage.

#### Parameters

##### commandId

`string`

#### Returns

`Promise`\<[`CommandRecord`](../interfaces/CommandRecord.md)\<`TLink`, `TCommand`, `unknown`\> \| `undefined`\>

#### Implementation of

[`ICommandStore`](../interfaces/ICommandStore.md).[`get`](../interfaces/ICommandStore.md#get)

---

### getBlockedBy()

> **getBlockedBy**(`commandId`): `Promise`\<[`CommandRecord`](../interfaces/CommandRecord.md)\<`TLink`, `TCommand`, `unknown`\>[]\>

Get commands blocked by a specific command. Scans in-memory map only.

#### Parameters

##### commandId

`string`

#### Returns

`Promise`\<[`CommandRecord`](../interfaces/CommandRecord.md)\<`TLink`, `TCommand`, `unknown`\>[]\>

#### Implementation of

[`ICommandStore`](../interfaces/ICommandStore.md).[`getBlockedBy`](../interfaces/ICommandStore.md#getblockedby)

---

### getByIds()

> **getByIds**(`commandIds`): `Promise`\<`Map`\<`string`, [`CommandRecord`](../interfaces/CommandRecord.md)\<`TLink`, `TCommand`, `unknown`\>\>\>

Batch variant of [get](../interfaces/ICommandStore.md#get). Returns a Map keyed by commandId; absent
keys mean the command is nowhere (memory, TTL cache, or storage).
Memory-first: in-memory hits resolve without touching storage; misses
are fetched in a single `IStorage.getCommandsByIds` call.

#### Parameters

##### commandIds

readonly `string`[]

#### Returns

`Promise`\<`Map`\<`string`, [`CommandRecord`](../interfaces/CommandRecord.md)\<`TLink`, `TCommand`, `unknown`\>\>\>

#### Implementation of

[`ICommandStore`](../interfaces/ICommandStore.md).[`getByIds`](../interfaces/ICommandStore.md#getbyids)

---

### getByStatus()

> **getByStatus**(`status`): `Promise`\<[`CommandRecord`](../interfaces/CommandRecord.md)\<`TLink`, `TCommand`, `unknown`\>[]\>

Get commands by status. In-memory filter for active statuses, storage for terminal.

#### Parameters

##### status

[`CommandStatus`](../type-aliases/CommandStatus.md) | [`CommandStatus`](../type-aliases/CommandStatus.md)[]

#### Returns

`Promise`\<[`CommandRecord`](../interfaces/CommandRecord.md)\<`TLink`, `TCommand`, `unknown`\>[]\>

#### Implementation of

[`ICommandStore`](../interfaces/ICommandStore.md).[`getByStatus`](../interfaces/ICommandStore.md#getbystatus)

---

### initialize()

> **initialize**(): `Promise`\<`void`\>

Load active commands from storage into memory. Called once at startup.

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`ICommandStore`](../interfaces/ICommandStore.md).[`initialize`](../interfaces/ICommandStore.md#initialize)

---

### list()

> **list**(`filter?`): `Promise`\<[`CommandRecord`](../interfaces/CommandRecord.md)\<`TLink`, `TCommand`, `unknown`\>[]\>

Get commands matching a filter. Merges in-memory with storage results when needed.

#### Parameters

##### filter?

[`CommandFilter`](../interfaces/CommandFilter.md)

#### Returns

`Promise`\<[`CommandRecord`](../interfaces/CommandRecord.md)\<`TLink`, `TCommand`, `unknown`\>[]\>

#### Implementation of

[`ICommandStore`](../interfaces/ICommandStore.md).[`list`](../interfaces/ICommandStore.md#list)

---

### save()

> **save**(`command`): `Promise`\<`void`\>

Save a new command. Assigns seq, writes to memory AND storage immediately
(must be durable before enqueue returns).

#### Parameters

##### command

[`CommandRecord`](../interfaces/CommandRecord.md)\<`TLink`, `TCommand`\>

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`ICommandStore`](../interfaces/ICommandStore.md).[`save`](../interfaces/ICommandStore.md#save)

---

### update()

> **update**(`commandId`, `updates`): `boolean`

Update a command in place. Mutates the in-memory reference, marks dirty for flush.
Returns true if the command was found and updated, false if not in memory.
SyncManager treats false as a harmless no-op. CommandQueue callers decide
whether false indicates a bug.

#### Parameters

##### commandId

`string`

##### updates

`Partial`\<[`CommandRecord`](../interfaces/CommandRecord.md)\<`TLink`, `TCommand`\>\>

#### Returns

`boolean`

#### Implementation of

[`ICommandStore`](../interfaces/ICommandStore.md).[`update`](../interfaces/ICommandStore.md#update)
