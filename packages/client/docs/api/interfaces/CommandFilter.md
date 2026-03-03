[**@cqrs-toolkit/client**](../README.md)

***

[@cqrs-toolkit/client](../globals.md) / CommandFilter

# Interface: CommandFilter

Defined in: packages/client/src/types/commands.ts:235

Filter for listing commands.

## Properties

### createdAfter?

> `optional` **createdAfter**: `number`

Defined in: packages/client/src/types/commands.ts:243

Created after timestamp

***

### createdBefore?

> `optional` **createdBefore**: `number`

Defined in: packages/client/src/types/commands.ts:245

Created before timestamp

***

### limit?

> `optional` **limit**: `number`

Defined in: packages/client/src/types/commands.ts:247

Limit number of results

***

### offset?

> `optional` **offset**: `number`

Defined in: packages/client/src/types/commands.ts:249

Offset for pagination

***

### service?

> `optional` **service**: `string`

Defined in: packages/client/src/types/commands.ts:241

Filter by service

***

### status?

> `optional` **status**: [`CommandStatus`](../type-aliases/CommandStatus.md) \| [`CommandStatus`](../type-aliases/CommandStatus.md)[]

Defined in: packages/client/src/types/commands.ts:237

Filter by status

***

### type?

> `optional` **type**: `string` \| `string`[]

Defined in: packages/client/src/types/commands.ts:239

Filter by type
