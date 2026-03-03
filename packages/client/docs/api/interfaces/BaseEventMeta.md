[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../README.md) / BaseEventMeta

# Interface: BaseEventMeta

Defined in: packages/client/src/types/events.ts:11

Base event metadata present on all events.

## Extended by

- [`AnticipatedEventMeta`](AnticipatedEventMeta.md)
- [`PermanentEventMeta`](PermanentEventMeta.md)
- [`StatefulEventMeta`](StatefulEventMeta.md)

## Properties

### createdAt

> **createdAt**: `Date`

Defined in: packages/client/src/types/events.ts:15

Event creation timestamp

---

### id

> **id**: `string`

Defined in: packages/client/src/types/events.ts:13

Unique event identifier
