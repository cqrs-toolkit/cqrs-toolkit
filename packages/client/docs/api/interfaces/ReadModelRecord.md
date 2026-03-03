[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../README.md) / ReadModelRecord

# Interface: ReadModelRecord

Defined in: packages/client/src/storage/IStorage.ts:69

Read model record.

## Properties

### cacheKey

> **cacheKey**: `string`

Defined in: packages/client/src/storage/IStorage.ts:75

Cache key this record belongs to

---

### collection

> **collection**: `string`

Defined in: packages/client/src/storage/IStorage.ts:73

Collection name

---

### effectiveData

> **effectiveData**: `string`

Defined in: packages/client/src/storage/IStorage.ts:79

Effective data including optimistic updates (JSON serialized)

---

### hasLocalChanges

> **hasLocalChanges**: `boolean`

Defined in: packages/client/src/storage/IStorage.ts:81

Whether this record has local modifications

---

### id

> **id**: `string`

Defined in: packages/client/src/storage/IStorage.ts:71

Entity ID

---

### serverData

> **serverData**: `string` \| `null`

Defined in: packages/client/src/storage/IStorage.ts:77

Server baseline data (JSON serialized)

---

### updatedAt

> **updatedAt**: `number`

Defined in: packages/client/src/storage/IStorage.ts:83

Last update timestamp
