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

### creates?

> `optional` **creates**: [`CreateCommandConfig`](CreateCommandConfig.md)

Create command configuration (present only for commands that create aggregates)

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

### postProcess?

> `optional` **postProcess**: [`PostProcessPlan`](PostProcessPlan.md)

Post-processing instructions from the domain executor

---

### revisionField?

> `optional` **revisionField**: `string`

Payload field name that holds the revision (from handler registration)

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
