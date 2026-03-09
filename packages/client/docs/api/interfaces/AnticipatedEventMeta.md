[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / AnticipatedEventMeta

# Interface: AnticipatedEventMeta

Anticipated event metadata — client-side optimistic event.
Associated with a command, replaced when server confirms.

## Properties

### commandId

> **commandId**: `string`

Command that produced this anticipated event

---

### createdAt

> **createdAt**: `number`

Event creation timestamp (epoch ms)

---

### id

> **id**: `string`

Unique event identifier

---

### persistence

> **persistence**: `"Anticipated"`
