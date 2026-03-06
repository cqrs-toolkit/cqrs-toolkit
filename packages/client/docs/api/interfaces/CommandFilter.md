[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / CommandFilter

# Interface: CommandFilter

Defined in: [packages/client/src/types/commands.ts:235](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/types/commands.ts#L235)

Filter for listing commands.

## Properties

### createdAfter?

> `optional` **createdAfter**: `number`

Defined in: [packages/client/src/types/commands.ts:243](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/types/commands.ts#L243)

Created after timestamp

---

### createdBefore?

> `optional` **createdBefore**: `number`

Defined in: [packages/client/src/types/commands.ts:245](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/types/commands.ts#L245)

Created before timestamp

---

### limit?

> `optional` **limit**: `number`

Defined in: [packages/client/src/types/commands.ts:247](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/types/commands.ts#L247)

Limit number of results

---

### offset?

> `optional` **offset**: `number`

Defined in: [packages/client/src/types/commands.ts:249](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/types/commands.ts#L249)

Offset for pagination

---

### service?

> `optional` **service**: `string`

Defined in: [packages/client/src/types/commands.ts:241](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/types/commands.ts#L241)

Filter by service

---

### status?

> `optional` **status**: [`CommandStatus`](../type-aliases/CommandStatus.md) \| [`CommandStatus`](../type-aliases/CommandStatus.md)[]

Defined in: [packages/client/src/types/commands.ts:237](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/types/commands.ts#L237)

Filter by status

---

### type?

> `optional` **type**: `string` \| `string`[]

Defined in: [packages/client/src/types/commands.ts:239](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/types/commands.ts#L239)

Filter by type
