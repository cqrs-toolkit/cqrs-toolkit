[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / AnticipatedEvent

# Interface: AnticipatedEvent\<TData\>

Anticipated event produced by local command execution.

## Type Parameters

### TData

`TData` = `unknown`

## Properties

### commandId

> **commandId**: `string`

---

### createdAt

> **createdAt**: `number`

---

### data

> **data**: `TData`

---

### id

> **id**: `string`

---

### metadata?

> `optional` **metadata**: `Record`\<`string`, `unknown`\>

Optional metadata; mirrors the server's persisted-event metadata locations
(e.g. `inTenant`) so projector code reads from the same place uniformly.

---

### persistence

> **persistence**: `"Anticipated"`

---

### streamId

> **streamId**: `string`

---

### type

> **type**: `string`
