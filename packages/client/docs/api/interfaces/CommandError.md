[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / CommandError

# Interface: CommandError

Defined in: [packages/client/src/types/commands.ts:33](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/types/commands.ts#L33)

Command error - can originate from local validation or server.

## Properties

### code?

> `optional` **code**: `string`

Defined in: [packages/client/src/types/commands.ts:39](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/types/commands.ts#L39)

Machine-readable code

---

### details?

> `optional` **details**: `unknown`

Defined in: [packages/client/src/types/commands.ts:43](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/types/commands.ts#L43)

Raw server error details

---

### message

> **message**: `string`

Defined in: [packages/client/src/types/commands.ts:37](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/types/commands.ts#L37)

Human-readable message

---

### source

> **source**: [`CommandErrorSource`](../type-aliases/CommandErrorSource.md)

Defined in: [packages/client/src/types/commands.ts:35](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/types/commands.ts#L35)

Error source

---

### validationErrors?

> `optional` **validationErrors**: [`ValidationError`](ValidationError.md)[]

Defined in: [packages/client/src/types/commands.ts:41](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/types/commands.ts#L41)

Field-level validation errors (for form display)
