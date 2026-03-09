[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / ValidationError

# Interface: ValidationError

Generic validation error for a single field.

## Properties

### code?

> `optional` **code**: `string`

Error code for programmatic handling (optional)

---

### context?

> `optional` **context**: `Record`\<`string`, `unknown`\>

Additional context (optional)

---

### message

> **message**: `string`

Error message for display

---

### path

> **path**: `string`

Field path (e.g., "email", "address.city", "items[0].name")
