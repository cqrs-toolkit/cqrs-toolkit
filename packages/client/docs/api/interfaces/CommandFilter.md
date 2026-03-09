[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / CommandFilter

# Interface: CommandFilter

Filter for listing commands.

## Properties

### createdAfter?

> `optional` **createdAfter**: `number`

Created after timestamp

---

### createdBefore?

> `optional` **createdBefore**: `number`

Created before timestamp

---

### limit?

> `optional` **limit**: `number`

Limit number of results

---

### offset?

> `optional` **offset**: `number`

Offset for pagination

---

### service?

> `optional` **service**: `string`

Filter by service

---

### status?

> `optional` **status**: [`CommandStatus`](../type-aliases/CommandStatus.md) \| [`CommandStatus`](../type-aliases/CommandStatus.md)[]

Filter by status

---

### type?

> `optional` **type**: `string` \| `string`[]

Filter by type
