[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / ICommandStore

# Interface: ICommandStore\<TLink, TCommand\>

## Type Parameters

### TLink

`TLink` _extends_ `Link`

### TCommand

`TCommand` _extends_ [`EnqueueCommand`](EnqueueCommand.md)

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

---

### delete()

> **delete**(`commandId`): `void`

Delete a command. Removes from memory, schedules storage delete via flush queue.

#### Parameters

##### commandId

`string`

#### Returns

`void`

---

### deleteAll()

> **deleteAll**(): `Promise`\<`void`\>

Delete all commands. Clears memory, delegates to storage.

#### Returns

`Promise`\<`void`\>

---

### destroy()

> **destroy**(): `Promise`\<`void`\>

Destroy — flush remaining changes and release resources.

#### Returns

`Promise`\<`void`\>

---

### flush()

> **flush**(): `Promise`\<`void`\>

Flush all pending changes to storage. Awaits in-flight flush if any.

#### Returns

`Promise`\<`void`\>

---

### get()

> **get**(`commandId`): `Promise`\<[`CommandRecord`](CommandRecord.md)\<`TLink`, `TCommand`, `unknown`\> \| `undefined`\>

Get a command by ID. Returns in-memory reference if present, falls through to storage.

#### Parameters

##### commandId

`string`

#### Returns

`Promise`\<[`CommandRecord`](CommandRecord.md)\<`TLink`, `TCommand`, `unknown`\> \| `undefined`\>

---

### getBlockedBy()

> **getBlockedBy**(`commandId`): `Promise`\<[`CommandRecord`](CommandRecord.md)\<`TLink`, `TCommand`, `unknown`\>[]\>

Get commands blocked by a specific command. Scans in-memory map only.

#### Parameters

##### commandId

`string`

#### Returns

`Promise`\<[`CommandRecord`](CommandRecord.md)\<`TLink`, `TCommand`, `unknown`\>[]\>

---

### getByIds()

> **getByIds**(`commandIds`): `Promise`\<`Map`\<`string`, [`CommandRecord`](CommandRecord.md)\<`TLink`, `TCommand`, `unknown`\>\>\>

Batch variant of [get](#get). Returns a Map keyed by commandId; absent
keys mean the command is nowhere (memory, TTL cache, or storage).
Memory-first: in-memory hits resolve without touching storage; misses
are fetched in a single `IStorage.getCommandsByIds` call.

#### Parameters

##### commandIds

readonly `string`[]

#### Returns

`Promise`\<`Map`\<`string`, [`CommandRecord`](CommandRecord.md)\<`TLink`, `TCommand`, `unknown`\>\>\>

---

### getByStatus()

> **getByStatus**(`status`): `Promise`\<[`CommandRecord`](CommandRecord.md)\<`TLink`, `TCommand`, `unknown`\>[]\>

Get commands by status. In-memory filter for active statuses, storage for terminal.

#### Parameters

##### status

[`CommandStatus`](../type-aliases/CommandStatus.md) | [`CommandStatus`](../type-aliases/CommandStatus.md)[]

#### Returns

`Promise`\<[`CommandRecord`](CommandRecord.md)\<`TLink`, `TCommand`, `unknown`\>[]\>

---

### initialize()

> **initialize**(): `Promise`\<`void`\>

Load active commands from storage into memory. Called once at startup.

#### Returns

`Promise`\<`void`\>

---

### list()

> **list**(`filter?`): `Promise`\<[`CommandRecord`](CommandRecord.md)\<`TLink`, `TCommand`, `unknown`\>[]\>

Get commands matching a filter. Merges in-memory with storage results when needed.

#### Parameters

##### filter?

[`CommandFilter`](CommandFilter.md)

#### Returns

`Promise`\<[`CommandRecord`](CommandRecord.md)\<`TLink`, `TCommand`, `unknown`\>[]\>

---

### save()

> **save**(`command`): `Promise`\<`void`\>

Save a new command. Assigns seq, writes to memory AND storage immediately
(must be durable before enqueue returns).

#### Parameters

##### command

[`CommandRecord`](CommandRecord.md)\<`TLink`, `TCommand`\>

#### Returns

`Promise`\<`void`\>

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

`Partial`\<[`CommandRecord`](CommandRecord.md)\<`TLink`, `TCommand`\>\>

#### Returns

`boolean`
