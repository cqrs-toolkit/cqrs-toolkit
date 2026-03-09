[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / CommandError

# Interface: CommandError

Command error - can originate from local validation or server.

## Properties

### code?

> `optional` **code**: `string`

Machine-readable code

---

### details?

> `optional` **details**: `unknown`

Raw server error details

---

### message

> **message**: `string`

Human-readable message

---

### source

> **source**: [`CommandErrorSource`](../type-aliases/CommandErrorSource.md)

Error source

---

### validationErrors?

> `optional` **validationErrors**: [`ValidationError`](ValidationError.md)[]

Field-level validation errors (for form display)
