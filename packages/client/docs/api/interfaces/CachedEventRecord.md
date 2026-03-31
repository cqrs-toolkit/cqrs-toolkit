[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / CachedEventRecord

# Interface: CachedEventRecord

Cached event record.

## Properties

### cacheKeys

> **cacheKeys**: `string`[]

Cache keys this event is associated with (junction table in SQL, array in memory)

---

### commandId

> **commandId**: `string` \| `null`

Command ID (for Anticipated events)

---

### createdAt

> **createdAt**: `number`

Event creation timestamp

---

### data

> **data**: `string`

Event data (JSON serialized)

---

### id

> **id**: `string`

Event ID

---

### persistence

> **persistence**: `"Permanent"` \| `"Stateful"` \| `"Anticipated"`

Event persistence type

---

### position

> **position**: `string` \| `null`

Global position (for Permanent events)

---

### processedAt

> **processedAt**: `number` \| `null`

Timestamp when the event was processed into the read model. Null if not yet processed.

---

### revision

> **revision**: `string` \| `null`

Stream revision (for Permanent events)

---

### streamId

> **streamId**: `string`

Stream ID

---

### type

> **type**: `string`

Event type
