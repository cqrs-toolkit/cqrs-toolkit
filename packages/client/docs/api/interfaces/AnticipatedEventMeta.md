[**@cqrs-toolkit/client**](../README.md)

***

[@cqrs-toolkit/client](../globals.md) / AnticipatedEventMeta

# Interface: AnticipatedEventMeta

Defined in: packages/client/src/types/events.ts:14

Anticipated event metadata — client-side optimistic event.
Associated with a command, replaced when server confirms.

## Properties

### commandId

> **commandId**: `string`

Defined in: packages/client/src/types/events.ts:21

Command that produced this anticipated event

***

### createdAt

> **createdAt**: `number`

Defined in: packages/client/src/types/events.ts:18

Event creation timestamp (epoch ms)

***

### id

> **id**: `string`

Defined in: packages/client/src/types/events.ts:16

Unique event identifier

***

### persistence

> **persistence**: `"Anticipated"`

Defined in: packages/client/src/types/events.ts:19
