[**@cqrs-toolkit/client**](../README.md)

***

[@cqrs-toolkit/client](../globals.md) / CachedEventRecord

# Interface: CachedEventRecord

Defined in: packages/client/src/storage/IStorage.ts:43

Cached event record.

## Properties

### cacheKey

> **cacheKey**: `string`

Defined in: packages/client/src/storage/IStorage.ts:61

Cache key this event belongs to

***

### commandId

> **commandId**: `string` \| `null`

Defined in: packages/client/src/storage/IStorage.ts:59

Command ID (for Anticipated events)

***

### createdAt

> **createdAt**: `number`

Defined in: packages/client/src/storage/IStorage.ts:63

Event creation timestamp

***

### data

> **data**: `string`

Defined in: packages/client/src/storage/IStorage.ts:53

Event data (JSON serialized)

***

### id

> **id**: `string`

Defined in: packages/client/src/storage/IStorage.ts:45

Event ID

***

### persistence

> **persistence**: `"Permanent"` \| `"Stateful"` \| `"Anticipated"`

Defined in: packages/client/src/storage/IStorage.ts:51

Event persistence type

***

### position

> **position**: `string` \| `null`

Defined in: packages/client/src/storage/IStorage.ts:55

Global position (for Permanent events)

***

### revision

> **revision**: `string` \| `null`

Defined in: packages/client/src/storage/IStorage.ts:57

Stream revision (for Permanent events)

***

### streamId

> **streamId**: `string`

Defined in: packages/client/src/storage/IStorage.ts:49

Stream ID

***

### type

> **type**: `string`

Defined in: packages/client/src/storage/IStorage.ts:47

Event type
