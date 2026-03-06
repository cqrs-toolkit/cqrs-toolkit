[**@cqrs-toolkit/client**](../../../../README.md)

---

[@cqrs-toolkit/client](../../../../globals.md) / [protocol](../README.md) / EventMessage

# Interface: EventMessage

Defined in: [packages/client/src/protocol/messages.ts:47](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/protocol/messages.ts#L47)

Event message broadcast from worker to windows.

## Properties

### debug?

> `optional` **debug**: `boolean`

Defined in: [packages/client/src/protocol/messages.ts:54](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/protocol/messages.ts#L54)

Whether this is a debug-only event

---

### eventName

> **eventName**: `string`

Defined in: [packages/client/src/protocol/messages.ts:50](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/protocol/messages.ts#L50)

Event name

---

### payload

> **payload**: `unknown`

Defined in: [packages/client/src/protocol/messages.ts:52](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/protocol/messages.ts#L52)

Event payload

---

### type

> **type**: `"event"`

Defined in: [packages/client/src/protocol/messages.ts:48](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/protocol/messages.ts#L48)
