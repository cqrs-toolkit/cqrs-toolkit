[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / CachedEventRecord

# Interface: CachedEventRecord

Defined in: [packages/client/src/storage/IStorage.ts:45](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/storage/IStorage.ts#L45)

Cached event record.

## Properties

### cacheKey

> **cacheKey**: `string`

Defined in: [packages/client/src/storage/IStorage.ts:63](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/storage/IStorage.ts#L63)

Cache key this event belongs to

---

### commandId

> **commandId**: `string` \| `null`

Defined in: [packages/client/src/storage/IStorage.ts:61](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/storage/IStorage.ts#L61)

Command ID (for Anticipated events)

---

### createdAt

> **createdAt**: `number`

Defined in: [packages/client/src/storage/IStorage.ts:65](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/storage/IStorage.ts#L65)

Event creation timestamp

---

### data

> **data**: `string`

Defined in: [packages/client/src/storage/IStorage.ts:55](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/storage/IStorage.ts#L55)

Event data (JSON serialized)

---

### id

> **id**: `string`

Defined in: [packages/client/src/storage/IStorage.ts:47](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/storage/IStorage.ts#L47)

Event ID

---

### persistence

> **persistence**: `"Permanent"` \| `"Stateful"` \| `"Anticipated"`

Defined in: [packages/client/src/storage/IStorage.ts:53](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/storage/IStorage.ts#L53)

Event persistence type

---

### position

> **position**: `string` \| `null`

Defined in: [packages/client/src/storage/IStorage.ts:57](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/storage/IStorage.ts#L57)

Global position (for Permanent events)

---

### revision

> **revision**: `string` \| `null`

Defined in: [packages/client/src/storage/IStorage.ts:59](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/storage/IStorage.ts#L59)

Stream revision (for Permanent events)

---

### streamId

> **streamId**: `string`

Defined in: [packages/client/src/storage/IStorage.ts:51](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/storage/IStorage.ts#L51)

Stream ID

---

### type

> **type**: `string`

Defined in: [packages/client/src/storage/IStorage.ts:49](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/storage/IStorage.ts#L49)

Event type
