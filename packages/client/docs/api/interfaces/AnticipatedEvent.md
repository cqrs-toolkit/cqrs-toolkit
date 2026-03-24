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

### persistence

> **persistence**: `"Anticipated"`

---

### streamId

> **streamId**: `string`

---

### type

> **type**: `string`
