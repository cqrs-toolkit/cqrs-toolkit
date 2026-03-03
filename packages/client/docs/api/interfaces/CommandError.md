[**@cqrs-toolkit/client**](../README.md)

***

[@cqrs-toolkit/client](../globals.md) / CommandError

# Interface: CommandError

Defined in: packages/client/src/types/commands.ts:33

Command error - can originate from local validation or server.

## Properties

### code?

> `optional` **code**: `string`

Defined in: packages/client/src/types/commands.ts:39

Machine-readable code

***

### details?

> `optional` **details**: `unknown`

Defined in: packages/client/src/types/commands.ts:43

Raw server error details

***

### message

> **message**: `string`

Defined in: packages/client/src/types/commands.ts:37

Human-readable message

***

### source

> **source**: [`CommandErrorSource`](../type-aliases/CommandErrorSource.md)

Defined in: packages/client/src/types/commands.ts:35

Error source

***

### validationErrors?

> `optional` **validationErrors**: [`ValidationError`](ValidationError.md)[]

Defined in: packages/client/src/types/commands.ts:41

Field-level validation errors (for form display)
