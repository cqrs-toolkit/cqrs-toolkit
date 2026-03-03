[**@cqrs-toolkit/client**](../README.md)

***

[@cqrs-toolkit/client](../globals.md) / AnticipatedEvent

# Interface: AnticipatedEvent\<TPayload\>

Defined in: packages/client/src/types/events.ts:27

Anticipated event produced by local command execution.

## Type Parameters

### TPayload

`TPayload` = `unknown`

## Properties

### commandId

> **commandId**: `string`

Defined in: packages/client/src/types/events.ts:34

***

### createdAt

> **createdAt**: `number`

Defined in: packages/client/src/types/events.ts:32

***

### data

> **data**: `TPayload`

Defined in: packages/client/src/types/events.ts:29

***

### id

> **id**: `string`

Defined in: packages/client/src/types/events.ts:31

***

### persistence

> **persistence**: `"Anticipated"`

Defined in: packages/client/src/types/events.ts:33

***

### streamId

> **streamId**: `string`

Defined in: packages/client/src/types/events.ts:30

***

### type

> **type**: `string`

Defined in: packages/client/src/types/events.ts:28
