[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / ValidationError

# Interface: ValidationError

Generic validation error for a single field.

## Properties

### code

> **code**: `string`

Error code for programmatic handling

---

### message

> **message**: `string`

Error message for display

---

### params

> **params**: `Record`\<`string`, `unknown`\>

Additional context

---

### path

> **path**: `string`

Field path (e.g., "email", "address.city", "items[0].name")
