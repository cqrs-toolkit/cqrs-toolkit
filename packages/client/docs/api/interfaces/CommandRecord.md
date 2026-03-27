[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / CommandRecord

# Interface: CommandRecord\<TLink, TData, TResponse\>

Persisted command record.

## Type Parameters

### TLink

`TLink` _extends_ `Link`

### TData

`TData` = `unknown`

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

### cacheKey

> **cacheKey**: [`CacheKeyIdentity`](../type-aliases/CacheKeyIdentity.md)\<`TLink`\>

Cache key identity — associates this command's events with the correct data scope. Serialized as JSON in SQL storage.

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

### data

> **data**: `TData`

Command data

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

### path?

> `optional` **path**: `unknown`

URL path template values for command sender URL expansion.

---

### postProcess?

> `optional` **postProcess**: [`PostProcessPlan`](PostProcessPlan.md)

Post-processing instructions from the domain executor

---

### revision?

> `optional` **revision**: `string` \| [`AutoRevision`](AutoRevision.md)

Revision for optimistic concurrency. AutoRevision markers are resolved before send.

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
