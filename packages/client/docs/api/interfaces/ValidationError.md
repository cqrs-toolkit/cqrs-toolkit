[**@cqrs-toolkit/client**](../README.md)

***

[@cqrs-toolkit/client](../globals.md) / ValidationError

# Interface: ValidationError

Defined in: packages/client/src/types/validation.ts:18

Generic validation error for a single field.

## Properties

### code?

> `optional` **code**: `string`

Defined in: packages/client/src/types/validation.ts:24

Error code for programmatic handling (optional)

***

### context?

> `optional` **context**: `Record`\<`string`, `unknown`\>

Defined in: packages/client/src/types/validation.ts:26

Additional context (optional)

***

### message

> **message**: `string`

Defined in: packages/client/src/types/validation.ts:22

Error message for display

***

### path

> **path**: `string`

Defined in: packages/client/src/types/validation.ts:20

Field path (e.g., "email", "address.city", "items[0].name")
