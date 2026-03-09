[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / CommandRecord

# Interface: CommandRecord\<TPayload, TResponse\>

Persisted command record.

## Type Parameters

### TPayload

`TPayload` = `unknown`

### TResponse

`TResponse` = `unknown`

## Properties

### attempts

> **attempts**: `number`

Number of send attempts

---

### blockedBy

> **blockedBy**: `string`[]

Commands blocked by this command

---

### commandId

> **commandId**: `string`

Unique command identifier (client-generated)

---

### createdAt

> **createdAt**: `number`

Creation timestamp

---

### dependsOn

> **dependsOn**: `string`[]

Commands this command depends on (must complete first)

---

### error?

> `optional` **error**: [`CommandError`](CommandError.md)

Error information if failed

---

### lastAttemptAt?

> `optional` **lastAttemptAt**: `number`

Timestamp of last send attempt

---

### payload

> **payload**: `TPayload`

Command payload

---

### serverResponse?

> `optional` **serverResponse**: `TResponse`

Server response on success

---

### service

> **service**: `string`

Target service for the command

---

### status

> **status**: [`CommandStatus`](../type-aliases/CommandStatus.md)

Current status

---

### type

> **type**: `string`

Command type (e.g., 'CreateTodo', 'UpdateUser')

---

### updatedAt

> **updatedAt**: `number`

Last update timestamp
