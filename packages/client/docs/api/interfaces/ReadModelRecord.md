[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / ReadModelRecord

# Interface: ReadModelRecord

Read model record.

## Properties

### cacheKey

> **cacheKey**: `string`

Cache key this record belongs to

---

### collection

> **collection**: `string`

Collection name

---

### effectiveData

> **effectiveData**: `string`

Effective data including optimistic updates (JSON serialized)

---

### hasLocalChanges

> **hasLocalChanges**: `boolean`

Whether this record has local modifications

---

### id

> **id**: `string`

Entity ID

---

### serverData

> **serverData**: `string` \| `null`

Server baseline data (JSON serialized)

---

### updatedAt

> **updatedAt**: `number`

Last update timestamp
