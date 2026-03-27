[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / EventBus

# Class: EventBus\<TLink\>

Event bus for library-level events.
All components can emit events, and consumers can subscribe to specific event types.

## Type Parameters

### TLink

`TLink` _extends_ `Link`

## Constructors

### Constructor

> **new EventBus**\<`TLink`\>(): `EventBus`\<`TLink`\>

#### Returns

`EventBus`\<`TLink`\>

## Properties

### debug

> **debug**: `boolean` = `false`

Whether debug events are enabled.
Mutable so the worker can enable debug after startup via RPC.
When false, `emitDebug()` is a no-op.

---

### events$

> `readonly` **events$**: `Observable`\<[`LibraryEvent`](../interfaces/LibraryEvent.md)\<`TLink`, [`LibraryEventType`](../type-aliases/LibraryEventType.md)\>\>

Observable of all library events.

## Methods

### complete()

> **complete**(): `void`

Complete the event bus.
Should be called when the client is destroyed.

#### Returns

`void`

---

### emit()

> **emit**\<`T`\>(`type`, `data`): `void`

Emit a library event.

#### Type Parameters

##### T

`T` _extends_ [`LibraryEventType`](../type-aliases/LibraryEventType.md)

#### Parameters

##### type

`T`

Event type

##### data

[`LibraryEventData`](../interfaces/LibraryEventData.md)\<`TLink`\>\[`T`\]

Event data

#### Returns

`void`

---

### emitDebug()

> **emitDebug**\<`T`\>(`type`, `data`): `void`

Emit a debug-only library event.
No-op when `this.debug` is false. When enabled, emits with `debug: true`
on the envelope so consumers can distinguish debug events.

#### Type Parameters

##### T

`T` _extends_ [`LibraryEventType`](../type-aliases/LibraryEventType.md)

#### Parameters

##### type

`T`

Event type

##### data

[`LibraryEventData`](../interfaces/LibraryEventData.md)\<`TLink`\>\[`T`\]

Event data

#### Returns

`void`

---

### on()

> **on**\<`T`\>(`type`): `Observable`\<[`LibraryEvent`](../interfaces/LibraryEvent.md)\<`TLink`, `T`\>\>

Get an observable filtered to a specific event type.

#### Type Parameters

##### T

`T` _extends_ [`LibraryEventType`](../type-aliases/LibraryEventType.md)

#### Parameters

##### type

`T`

Event type to filter for

#### Returns

`Observable`\<[`LibraryEvent`](../interfaces/LibraryEvent.md)\<`TLink`, `T`\>\>

Observable of events of that type

---

### onAny()

> **onAny**\<`T`\>(`types`): `Observable`\<[`LibraryEvent`](../interfaces/LibraryEvent.md)\<`TLink`, `T`\>\>

Get an observable filtered to multiple event types.

#### Type Parameters

##### T

`T` _extends_ [`LibraryEventType`](../type-aliases/LibraryEventType.md)

#### Parameters

##### types

`T`[]

Event types to filter for

#### Returns

`Observable`\<[`LibraryEvent`](../interfaces/LibraryEvent.md)\<`TLink`, `T`\>\>

Observable of events of those types
