[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / LibraryEvent

# Interface: LibraryEvent\<T\>

Typed library event.

## Type Parameters

### T

`T` _extends_ [`LibraryEventType`](../type-aliases/LibraryEventType.md) = [`LibraryEventType`](../type-aliases/LibraryEventType.md)

## Properties

### debug?

> `optional` **debug**: `boolean`

Whether this event is a debug-only event (emitted via `emitDebug()`).

---

### payload

> **payload**: [`LibraryEventPayloads`](LibraryEventPayloads.md)\[`T`\]

---

### timestamp

> **timestamp**: `number`

---

### type

> **type**: `T`
