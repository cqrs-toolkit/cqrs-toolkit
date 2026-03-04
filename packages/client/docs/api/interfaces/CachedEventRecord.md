[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / CachedEventRecord

# Interface: CachedEventRecord

Defined in: packages/client/src/storage/IStorage.ts:45

Cached event record.

## Properties

### cacheKey

> **cacheKey**: `string`

Defined in: packages/client/src/storage/IStorage.ts:63

Cache key this event belongs to

---

### commandId

> **commandId**: `string` \| `null`

Defined in: packages/client/src/storage/IStorage.ts:61

Command ID (for Anticipated events)

---

### createdAt

> **createdAt**: `number`

Defined in: packages/client/src/storage/IStorage.ts:65

Event creation timestamp

---

### data

> **data**: `string`

Defined in: packages/client/src/storage/IStorage.ts:55

Event data (JSON serialized)

---

### id

> **id**: `string`

Defined in: packages/client/src/storage/IStorage.ts:47

Event ID

---

### persistence

> **persistence**: `"Permanent"` \| `"Stateful"` \| `"Anticipated"`

Defined in: packages/client/src/storage/IStorage.ts:53

Event persistence type

---

### position

> **position**: `string` \| `null`

Defined in: packages/client/src/storage/IStorage.ts:57

Global position (for Permanent events)

---

### revision

> **revision**: `string` \| `null`

Defined in: packages/client/src/storage/IStorage.ts:59

Stream revision (for Permanent events)

---

### streamId

> **streamId**: `string`

Defined in: packages/client/src/storage/IStorage.ts:51

Stream ID

---

### type

> **type**: `string`

Defined in: packages/client/src/storage/IStorage.ts:49

Event type
