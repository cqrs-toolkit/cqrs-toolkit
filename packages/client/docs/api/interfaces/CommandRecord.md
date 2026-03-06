[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / CommandRecord

# Interface: CommandRecord\<TPayload, TResponse\>

Defined in: [packages/client/src/types/commands.ts:49](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/commands.ts#L49)

Persisted command record.

## Type Parameters

### TPayload

`TPayload` = `unknown`

### TResponse

`TResponse` = `unknown`

## Properties

### attempts

> **attempts**: `number`

Defined in: [packages/client/src/types/commands.ts:65](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/commands.ts#L65)

Number of send attempts

---

### blockedBy

> **blockedBy**: `string`[]

Defined in: [packages/client/src/types/commands.ts:63](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/commands.ts#L63)

Commands blocked by this command

---

### commandId

> **commandId**: `string`

Defined in: [packages/client/src/types/commands.ts:51](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/commands.ts#L51)

Unique command identifier (client-generated)

---

### createdAt

> **createdAt**: `number`

Defined in: [packages/client/src/types/commands.ts:73](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/commands.ts#L73)

Creation timestamp

---

### dependsOn

> **dependsOn**: `string`[]

Defined in: [packages/client/src/types/commands.ts:61](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/commands.ts#L61)

Commands this command depends on (must complete first)

---

### error?

> `optional` **error**: [`CommandError`](CommandError.md)

Defined in: [packages/client/src/types/commands.ts:69](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/commands.ts#L69)

Error information if failed

---

### lastAttemptAt?

> `optional` **lastAttemptAt**: `number`

Defined in: [packages/client/src/types/commands.ts:67](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/commands.ts#L67)

Timestamp of last send attempt

---

### payload

> **payload**: `TPayload`

Defined in: [packages/client/src/types/commands.ts:57](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/commands.ts#L57)

Command payload

---

### serverResponse?

> `optional` **serverResponse**: `TResponse`

Defined in: [packages/client/src/types/commands.ts:71](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/commands.ts#L71)

Server response on success

---

### service

> **service**: `string`

Defined in: [packages/client/src/types/commands.ts:53](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/commands.ts#L53)

Target service for the command

---

### status

> **status**: [`CommandStatus`](../type-aliases/CommandStatus.md)

Defined in: [packages/client/src/types/commands.ts:59](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/commands.ts#L59)

Current status

---

### type

> **type**: `string`

Defined in: [packages/client/src/types/commands.ts:55](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/commands.ts#L55)

Command type (e.g., 'CreateTodo', 'UpdateUser')

---

### updatedAt

> **updatedAt**: `number`

Defined in: [packages/client/src/types/commands.ts:75](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/commands.ts#L75)

Last update timestamp
