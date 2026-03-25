[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / ExecutorCommand

# Interface: ExecutorCommand

Minimum command envelope shape required by the domain executor.
The executor needs the command type for dispatch, data for validation/handling,
and path for URL template values passed to validateAsync and handler contexts.

## Properties

### data

> **data**: `unknown`

Command data (HTTP body payload)

---

### path?

> `optional` **path**: `unknown`

URL path template values from the command envelope

---

### type

> **type**: `string`

Command type for dispatch
