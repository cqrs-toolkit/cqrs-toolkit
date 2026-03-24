[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / LibraryEvent

# Interface: LibraryEvent\<T\>

Typed library event.

## Type Parameters

### T

`T` _extends_ [`LibraryEventType`](../type-aliases/LibraryEventType.md) = [`LibraryEventType`](../type-aliases/LibraryEventType.md)

## Properties

### data

> **data**: [`LibraryEventData`](LibraryEventData.md)\[`T`\]

---

### debug?

> `optional` **debug**: `boolean`

Whether this event is a debug-only event (emitted via `emitDebug()`).

---

### timestamp

> **timestamp**: `number`

---

### type

> **type**: `T`
