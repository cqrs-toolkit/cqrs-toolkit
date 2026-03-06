[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / LibraryEvent

# Interface: LibraryEvent\<T\>

Defined in: [packages/client/src/types/events.ts:124](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/events.ts#L124)

Typed library event.

## Type Parameters

### T

`T` _extends_ [`LibraryEventType`](../type-aliases/LibraryEventType.md) = [`LibraryEventType`](../type-aliases/LibraryEventType.md)

## Properties

### debug?

> `optional` **debug**: `boolean`

Defined in: [packages/client/src/types/events.ts:129](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/events.ts#L129)

Whether this event is a debug-only event (emitted via `emitDebug()`).

---

### payload

> **payload**: [`LibraryEventPayloads`](LibraryEventPayloads.md)\[`T`\]

Defined in: [packages/client/src/types/events.ts:126](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/events.ts#L126)

---

### timestamp

> **timestamp**: `number`

Defined in: [packages/client/src/types/events.ts:127](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/events.ts#L127)

---

### type

> **type**: `T`

Defined in: [packages/client/src/types/events.ts:125](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/events.ts#L125)
