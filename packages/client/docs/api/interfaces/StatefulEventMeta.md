[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../README.md) / StatefulEventMeta

# Interface: StatefulEventMeta

Defined in: packages/client/src/types/events.ts:34

Stateful event - server event without global ordering.
Best-effort delivery, may require snapshot refetch.

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

### persistence

> **persistence**: `"Stateful"`

Defined in: packages/client/src/types/events.ts:35
