[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / CommandEvent

# Interface: CommandEvent

Command event emitted when a command's state changes.

## Properties

### commandId

> **commandId**: `string`

Command ID

---

### error?

> `optional` **error**: `IException`\<`unknown`\>

Error information (for failed events)

---

### eventType

> **eventType**: [`CommandEventType`](../type-aliases/CommandEventType.md)

Event type

---

### previousStatus?

> `optional` **previousStatus**: [`CommandStatus`](../type-aliases/CommandStatus.md)

Previous status (for status-changed events)

---

### response?

> `optional` **response**: `unknown`

Server response (for completed events)

---

### status

> **status**: [`CommandStatus`](../type-aliases/CommandStatus.md)

Current status

---

### timestamp

> **timestamp**: `number`

Event timestamp

---

### type

> **type**: `string`

Command type
