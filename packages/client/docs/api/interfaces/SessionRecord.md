[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../README.md) / SessionRecord

# Interface: SessionRecord

Defined in: packages/client/src/storage/IStorage.ts:11

Session record stored in the database.

## Properties

### createdAt

> **createdAt**: `number`

Defined in: packages/client/src/storage/IStorage.ts:17

Session creation timestamp

---

### id

> **id**: `1`

Defined in: packages/client/src/storage/IStorage.ts:13

Always 1 - single session constraint

---

### lastSeenAt

> **lastSeenAt**: `number`

Defined in: packages/client/src/storage/IStorage.ts:19

Last activity timestamp

---

### userId

> **userId**: `string`

Defined in: packages/client/src/storage/IStorage.ts:15

User identifier
