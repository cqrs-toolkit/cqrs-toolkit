[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / SessionRecord

# Interface: SessionRecord

Defined in: [packages/client/src/storage/IStorage.ts:11](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/storage/IStorage.ts#L11)

Session record stored in the database.

## Properties

### createdAt

> **createdAt**: `number`

Defined in: [packages/client/src/storage/IStorage.ts:17](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/storage/IStorage.ts#L17)

Session creation timestamp

---

### id

> **id**: `1`

Defined in: [packages/client/src/storage/IStorage.ts:13](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/storage/IStorage.ts#L13)

Always 1 - single session constraint

---

### lastSeenAt

> **lastSeenAt**: `number`

Defined in: [packages/client/src/storage/IStorage.ts:19](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/storage/IStorage.ts#L19)

Last activity timestamp

---

### userId

> **userId**: `string`

Defined in: [packages/client/src/storage/IStorage.ts:15](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/storage/IStorage.ts#L15)

User identifier
