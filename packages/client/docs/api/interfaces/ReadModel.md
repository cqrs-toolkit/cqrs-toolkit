[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / ReadModel

# Interface: ReadModel\<T\>

Read model with metadata.

## Type Parameters

### T

`T` = `unknown`

## Properties

### \_clientMetadata?

> `optional` **\_clientMetadata**: [`ClientMetadata`](ClientMetadata.md)

Client-side identity tracking metadata. Undefined for server-seeded entries.

---

### collection

> **collection**: `string`

Collection name

---

### data

> **data**: `T`

Effective data (server + local changes)

---

### hasLocalChanges

> **hasLocalChanges**: `boolean`

Whether there are uncommitted local changes

---

### id

> **id**: `string`

Entity ID

---

### position?

> `optional` **position**: `string`

Global position of the last event that updated this entity. Undefined for locally-created entries.

---

### revision?

> `optional` **revision**: `string`

Stream revision of the last event that updated this entity. Undefined for locally-created entries.

---

### serverData?

> `optional` **serverData**: `T`

Server baseline data (undefined if only local)

---

### updatedAt

> **updatedAt**: `number`

Last update timestamp
