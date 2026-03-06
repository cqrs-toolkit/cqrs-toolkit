[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / ReadModelRecord

# Interface: ReadModelRecord

Defined in: [packages/client/src/storage/IStorage.ts:71](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/storage/IStorage.ts#L71)

Read model record.

## Properties

### cacheKey

> **cacheKey**: `string`

Defined in: [packages/client/src/storage/IStorage.ts:77](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/storage/IStorage.ts#L77)

Cache key this record belongs to

---

### collection

> **collection**: `string`

Defined in: [packages/client/src/storage/IStorage.ts:75](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/storage/IStorage.ts#L75)

Collection name

---

### effectiveData

> **effectiveData**: `string`

Defined in: [packages/client/src/storage/IStorage.ts:81](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/storage/IStorage.ts#L81)

Effective data including optimistic updates (JSON serialized)

---

### hasLocalChanges

> **hasLocalChanges**: `boolean`

Defined in: [packages/client/src/storage/IStorage.ts:83](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/storage/IStorage.ts#L83)

Whether this record has local modifications

---

### id

> **id**: `string`

Defined in: [packages/client/src/storage/IStorage.ts:73](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/storage/IStorage.ts#L73)

Entity ID

---

### serverData

> **serverData**: `string` \| `null`

Defined in: [packages/client/src/storage/IStorage.ts:79](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/storage/IStorage.ts#L79)

Server baseline data (JSON serialized)

---

### updatedAt

> **updatedAt**: `number`

Defined in: [packages/client/src/storage/IStorage.ts:85](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/storage/IStorage.ts#L85)

Last update timestamp
