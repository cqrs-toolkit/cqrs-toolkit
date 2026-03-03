[**@cqrs-toolkit/client**](../README.md)

***

[@cqrs-toolkit/client](../globals.md) / CommandEvent

# Interface: CommandEvent

Defined in: packages/client/src/types/commands.ts:213

Command event emitted when a command's state changes.

## Properties

### commandId

> **commandId**: `string`

Defined in: packages/client/src/types/commands.ts:217

Command ID

***

### error?

> `optional` **error**: [`CommandError`](CommandError.md)

Defined in: packages/client/src/types/commands.ts:225

Error information (for failed events)

***

### eventType

> **eventType**: [`CommandEventType`](../type-aliases/CommandEventType.md)

Defined in: packages/client/src/types/commands.ts:215

Event type

***

### previousStatus?

> `optional` **previousStatus**: [`CommandStatus`](../type-aliases/CommandStatus.md)

Defined in: packages/client/src/types/commands.ts:223

Previous status (for status-changed events)

***

### response?

> `optional` **response**: `unknown`

Defined in: packages/client/src/types/commands.ts:227

Server response (for completed events)

***

### status

> **status**: [`CommandStatus`](../type-aliases/CommandStatus.md)

Defined in: packages/client/src/types/commands.ts:221

Current status

***

### timestamp

> **timestamp**: `number`

Defined in: packages/client/src/types/commands.ts:229

Event timestamp

***

### type

> **type**: `string`

Defined in: packages/client/src/types/commands.ts:219

Command type
