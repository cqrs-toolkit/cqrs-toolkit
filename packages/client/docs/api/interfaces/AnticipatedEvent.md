[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / AnticipatedEvent

# Interface: AnticipatedEvent\<TPayload\>

Anticipated event produced by local command execution.

## Type Parameters

### TPayload

`TPayload` = `unknown`

## Properties

### commandId

> **commandId**: `string`

---

### createdAt

> **createdAt**: `number`

---

### data

> **data**: `TPayload`

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
