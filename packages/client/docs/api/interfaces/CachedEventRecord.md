[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / CachedEventRecord

# Interface: CachedEventRecord

Cached event record.

## Properties

### cacheKey

> **cacheKey**: `string`

Cache key this event belongs to

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
