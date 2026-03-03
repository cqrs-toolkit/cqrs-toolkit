[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../README.md) / CommandRecord

# Interface: CommandRecord\<TPayload, TResponse\>

Defined in: packages/client/src/types/commands.ts:42

Persisted command record.

## Type Parameters

### TPayload

`TPayload` = `unknown`

### TResponse

`TResponse` = `unknown`

## Properties

### anticipatedEventIds

> **anticipatedEventIds**: `string`[]

Defined in: packages/client/src/types/commands.ts:62

IDs of anticipated events produced by this command

---

### attempts

> **attempts**: `number`

Defined in: packages/client/src/types/commands.ts:58

Number of send attempts

---

### blockedBy

> **blockedBy**: `string`[]

Defined in: packages/client/src/types/commands.ts:56

Commands blocked by this command

---

### commandId

> **commandId**: `string`

Defined in: packages/client/src/types/commands.ts:44

Unique command identifier (client-generated)

---

### createdAt

> **createdAt**: `number`

Defined in: packages/client/src/types/commands.ts:68

Creation timestamp

---

### dependsOn

> **dependsOn**: `string`[]

Defined in: packages/client/src/types/commands.ts:54

Commands this command depends on (must complete first)

---

### error?

> `optional` **error**: [`CommandError`](CommandError.md)

Defined in: packages/client/src/types/commands.ts:64

Error information if failed

---

### lastAttemptAt?

> `optional` **lastAttemptAt**: `number`

Defined in: packages/client/src/types/commands.ts:60

Timestamp of last send attempt

---

### payload

> **payload**: `TPayload`

Defined in: packages/client/src/types/commands.ts:50

Command payload

---

### serverResponse?

> `optional` **serverResponse**: `TResponse`

Defined in: packages/client/src/types/commands.ts:66

Server response on success

---

### service

> **service**: `string`

Defined in: packages/client/src/types/commands.ts:46

Target service for the command

---

### status

> **status**: [`CommandStatus`](../type-aliases/CommandStatus.md)

Defined in: packages/client/src/types/commands.ts:52

Current status

---

### type

> **type**: `string`

Defined in: packages/client/src/types/commands.ts:48

Command type (e.g., 'CreateTodo', 'UpdateUser')

---

### updatedAt

> **updatedAt**: `number`

Defined in: packages/client/src/types/commands.ts:70

Last update timestamp
