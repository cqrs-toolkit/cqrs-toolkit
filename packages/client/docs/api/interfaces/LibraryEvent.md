[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / LibraryEvent

# Interface: LibraryEvent\<T\>

Defined in: [packages/client/src/types/events.ts:93](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/types/events.ts#L93)

Typed library event.

## Type Parameters

### T

`T` _extends_ [`LibraryEventType`](../type-aliases/LibraryEventType.md) = [`LibraryEventType`](../type-aliases/LibraryEventType.md)

## Properties

### payload

> **payload**: [`LibraryEventPayloads`](LibraryEventPayloads.md)\[`T`\]

Defined in: [packages/client/src/types/events.ts:95](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/types/events.ts#L95)

---

### timestamp

> **timestamp**: `number`

Defined in: [packages/client/src/types/events.ts:96](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/types/events.ts#L96)

---

### type

> **type**: `T`

Defined in: [packages/client/src/types/events.ts:94](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/types/events.ts#L94)
