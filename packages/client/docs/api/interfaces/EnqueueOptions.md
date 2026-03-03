[**@cqrs-toolkit/client**](../README.md)

***

[@cqrs-toolkit/client](../globals.md) / EnqueueOptions

# Interface: EnqueueOptions

Defined in: packages/client/src/types/commands.ts:90

Options for enqueue operation.

## Extended by

- [`EnqueueAndWaitOptions`](EnqueueAndWaitOptions.md)

## Properties

### commandId?

> `optional` **commandId**: `string`

Defined in: packages/client/src/types/commands.ts:94

Custom command ID (defaults to generated UUID)

***

### skipValidation?

> `optional` **skipValidation**: `boolean`

Defined in: packages/client/src/types/commands.ts:92

Skip local domain validation
