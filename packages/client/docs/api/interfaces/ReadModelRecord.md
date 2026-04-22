[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / ReadModelRecord

# Interface: ReadModelRecord

Read model record.

## Properties

### \_clientMetadata

> **\_clientMetadata**: [`ClientMetadata`](ClientMetadata.md) \| `null`

Client-side identity tracking metadata.
Set when an anticipated event creates a read model entry from a command
with `creates.idStrategy === 'temporary'`. Persists through reconciliation
so the Solid query primitive can maintain stable references.
Null for server-seeded entries and non-create commands.

---

### cacheKeys

> **cacheKeys**: `string`[]

Cache keys this record is associated with (junction table in SQL, array in memory)

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

### position

> **position**: `string` \| `null`

Global position of the last event that updated this read model (bigint as string). Null for locally-created entries.

---

### revision

> **revision**: `string` \| `null`

Stream revision of the last event that updated this read model (bigint as string).
Null for locally-created entries.

A scalar revision is sufficient because each [Collection](Collection.md) tracks exactly
one aggregate via its required `aggregate` field — the revision is that aggregate's
stream position. A future `CompositeCollection` type built from multiple aggregates
would need a per-aggregate revision map instead.

---

### serverData

> **serverData**: `string` \| `null`

Server baseline data (JSON serialized)

---

### updatedAt

> **updatedAt**: `number`

Last update timestamp
