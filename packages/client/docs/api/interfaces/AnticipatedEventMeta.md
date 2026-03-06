[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / AnticipatedEventMeta

# Interface: AnticipatedEventMeta

Defined in: [packages/client/src/types/events.ts:14](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/types/events.ts#L14)

Anticipated event metadata — client-side optimistic event.
Associated with a command, replaced when server confirms.

## Properties

### commandId

> **commandId**: `string`

Defined in: [packages/client/src/types/events.ts:21](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/types/events.ts#L21)

Command that produced this anticipated event

---

### createdAt

> **createdAt**: `number`

Defined in: [packages/client/src/types/events.ts:18](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/types/events.ts#L18)

Event creation timestamp (epoch ms)

---

### id

> **id**: `string`

Defined in: [packages/client/src/types/events.ts:16](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/types/events.ts#L16)

Unique event identifier

---

### persistence

> **persistence**: `"Anticipated"`

Defined in: [packages/client/src/types/events.ts:19](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/types/events.ts#L19)
