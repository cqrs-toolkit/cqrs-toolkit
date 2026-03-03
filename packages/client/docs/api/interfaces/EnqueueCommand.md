[**@cqrs-toolkit/client**](../README.md)

***

[@cqrs-toolkit/client](../globals.md) / EnqueueCommand

# Interface: EnqueueCommand\<TPayload\>

Defined in: packages/client/src/types/commands.ts:81

Command to enqueue.

## Type Parameters

### TPayload

`TPayload` = `unknown`

## Properties

### dependsOn?

> `optional` **dependsOn**: `string`[]

Defined in: packages/client/src/types/commands.ts:89

Commands this depends on (optional)

***

### payload

> **payload**: `TPayload`

Defined in: packages/client/src/types/commands.ts:85

Command payload

***

### service?

> `optional` **service**: `string`

Defined in: packages/client/src/types/commands.ts:87

Target service (optional, defaults to primary)

***

### type

> **type**: `string`

Defined in: packages/client/src/types/commands.ts:83

Command type
