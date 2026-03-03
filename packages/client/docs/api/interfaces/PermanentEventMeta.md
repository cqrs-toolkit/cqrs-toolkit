[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../README.md) / PermanentEventMeta

# Interface: PermanentEventMeta

Defined in: packages/client/src/types/events.ts:22

Permanent event - server-authoritative with global ordering.
If persistence field is missing, treat as Permanent.

## Extends

- [`BaseEventMeta`](BaseEventMeta.md)

## Properties

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

### persistence?

> `optional` **persistence**: `"Permanent"`

Defined in: packages/client/src/types/events.ts:23

---

### position

> **position**: `bigint`

Defined in: packages/client/src/types/events.ts:27

Global position for ordering

---

### revision

> **revision**: `bigint`

Defined in: packages/client/src/types/events.ts:25

Stream-local revision number
