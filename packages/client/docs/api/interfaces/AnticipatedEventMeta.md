[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../README.md) / AnticipatedEventMeta

# Interface: AnticipatedEventMeta

Defined in: packages/client/src/types/events.ts:42

Anticipated event - client-side optimistic event.
Associated with a command, replaced when server confirms.

## Extends

- [`BaseEventMeta`](BaseEventMeta.md)

## Properties

### commandId

> **commandId**: `string`

Defined in: packages/client/src/types/events.ts:45

Command that produced this anticipated event

---

### createdAt

> **createdAt**: `Date`

Defined in: packages/client/src/types/events.ts:15

Event creation timestamp

#### Inherited from

[`BaseEventMeta`](BaseEventMeta.md).[`createdAt`](BaseEventMeta.md#createdat)

---

### id

> **id**: `string`

Defined in: packages/client/src/types/events.ts:13

Unique event identifier

#### Inherited from

[`BaseEventMeta`](BaseEventMeta.md).[`id`](BaseEventMeta.md#id)

---

### persistence

> **persistence**: `"Anticipated"`

Defined in: packages/client/src/types/events.ts:43
