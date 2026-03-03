[**@cqrs-toolkit/client**](../README.md)

***

[@cqrs-toolkit/client](../globals.md) / ValidationError

# Interface: ValidationError

Defined in: packages/client/src/types/validation.ts:9

Generic validation error for a single field.

## Properties

### code?

> `optional` **code**: `string`

Defined in: packages/client/src/types/validation.ts:15

Error code for programmatic handling (optional)

***

### context?

> `optional` **context**: `Record`\<`string`, `unknown`\>

Defined in: packages/client/src/types/validation.ts:17

Additional context (optional)

***

### message

> **message**: `string`

Defined in: packages/client/src/types/validation.ts:13

Error message for display

***

### path

> **path**: `string`

Defined in: packages/client/src/types/validation.ts:11

Field path (e.g., "email", "address.city", "items[0].name")
