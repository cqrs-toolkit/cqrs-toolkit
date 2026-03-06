[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / AnticipatedEvent

# Interface: AnticipatedEvent\<TPayload\>

Defined in: [packages/client/src/types/events.ts:27](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/events.ts#L27)

Anticipated event produced by local command execution.

## Type Parameters

### TPayload

`TPayload` = `unknown`

## Properties

### commandId

> **commandId**: `string`

Defined in: [packages/client/src/types/events.ts:34](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/events.ts#L34)

---

### createdAt

> **createdAt**: `number`

Defined in: [packages/client/src/types/events.ts:32](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/events.ts#L32)

---

### data

> **data**: `TPayload`

Defined in: [packages/client/src/types/events.ts:29](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/events.ts#L29)

---

### id

> **id**: `string`

Defined in: [packages/client/src/types/events.ts:31](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/events.ts#L31)

---

### persistence

> **persistence**: `"Anticipated"`

Defined in: [packages/client/src/types/events.ts:33](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/events.ts#L33)

---

### streamId

> **streamId**: `string`

Defined in: [packages/client/src/types/events.ts:30](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/events.ts#L30)

---

### type

> **type**: `string`

Defined in: [packages/client/src/types/events.ts:28](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/events.ts#L28)
