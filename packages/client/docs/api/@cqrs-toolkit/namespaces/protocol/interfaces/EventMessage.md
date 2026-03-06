[**@cqrs-toolkit/client**](../../../../README.md)

---

[@cqrs-toolkit/client](../../../../globals.md) / [protocol](../README.md) / EventMessage

# Interface: EventMessage

Defined in: [packages/client/src/protocol/messages.ts:47](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/protocol/messages.ts#L47)

Event message broadcast from worker to windows.

## Properties

### eventName

> **eventName**: `string`

Defined in: [packages/client/src/protocol/messages.ts:50](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/protocol/messages.ts#L50)

Event name

---

### payload

> **payload**: `unknown`

Defined in: [packages/client/src/protocol/messages.ts:52](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/protocol/messages.ts#L52)

Event payload

---

### type

> **type**: `"event"`

Defined in: [packages/client/src/protocol/messages.ts:48](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/protocol/messages.ts#L48)
