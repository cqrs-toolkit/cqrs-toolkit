[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / ReadModelRecord

# Interface: ReadModelRecord

Defined in: packages/client/src/storage/IStorage.ts:71

Read model record.

## Properties

### cacheKey

> **cacheKey**: `string`

Defined in: packages/client/src/storage/IStorage.ts:77

Cache key this record belongs to

---

### collection

> **collection**: `string`

Defined in: packages/client/src/storage/IStorage.ts:75

Collection name

---

### effectiveData

> **effectiveData**: `string`

Defined in: packages/client/src/storage/IStorage.ts:81

Effective data including optimistic updates (JSON serialized)

---

### hasLocalChanges

> **hasLocalChanges**: `boolean`

Defined in: packages/client/src/storage/IStorage.ts:83

Whether this record has local modifications

---

### id

> **id**: `string`

Defined in: packages/client/src/storage/IStorage.ts:73

Entity ID

---

### serverData

> **serverData**: `string` \| `null`

Defined in: packages/client/src/storage/IStorage.ts:79

Server baseline data (JSON serialized)

---

### updatedAt

> **updatedAt**: `number`

Defined in: packages/client/src/storage/IStorage.ts:85

Last update timestamp
