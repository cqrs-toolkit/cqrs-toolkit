[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / LibraryEvent

# Interface: LibraryEvent\<TLink, T\>

Typed library event.

## Type Parameters

### TLink

`TLink` _extends_ `Link`

### T

`T` _extends_ [`LibraryEventType`](../type-aliases/LibraryEventType.md) = [`LibraryEventType`](../type-aliases/LibraryEventType.md)

## Properties

### data

> **data**: [`LibraryEventData`](LibraryEventData.md)\<`TLink`\>\[`T`\]

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
