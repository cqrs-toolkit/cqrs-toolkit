[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../README.md) / CommandError

# Interface: CommandError

Defined in: packages/client/src/types/commands.ts:26

Command error - can originate from local validation or server.

## Properties

### code?

> `optional` **code**: `string`

Defined in: packages/client/src/types/commands.ts:32

Machine-readable code

---

### details?

> `optional` **details**: `unknown`

Defined in: packages/client/src/types/commands.ts:36

Raw server error details

---

### message

> **message**: `string`

Defined in: packages/client/src/types/commands.ts:30

Human-readable message

---

### source

> **source**: [`CommandErrorSource`](../type-aliases/CommandErrorSource.md)

Defined in: packages/client/src/types/commands.ts:28

Error source

---

### validationErrors?

> `optional` **validationErrors**: [`ValidationError`](ValidationError.md)[]

Defined in: packages/client/src/types/commands.ts:34

Field-level validation errors (for form display)
