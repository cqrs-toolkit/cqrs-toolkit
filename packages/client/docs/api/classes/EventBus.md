[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../README.md) / EventBus

# Class: EventBus

Defined in: packages/client/src/core/events/EventBus.ts:13

Event bus for library-level events.
All components can emit events, and consumers can subscribe to specific event types.

## Constructors

### Constructor

> **new EventBus**(): `EventBus`

Defined in: packages/client/src/core/events/EventBus.ts:21

#### Returns

`EventBus`

## Properties

### events$

> `readonly` **events$**: `Observable`\<[`LibraryEvent`](../interfaces/LibraryEvent.md)\<[`LibraryEventType`](../type-aliases/LibraryEventType.md)\>\>

Defined in: packages/client/src/core/events/EventBus.ts:19

Observable of all library events.

## Methods

### complete()

> **complete**(): `void`

Defined in: packages/client/src/core/events/EventBus.ts:67

Complete the event bus.
Should be called when the client is destroyed.

#### Returns

`void`

---

### emit()

> **emit**\<`T`\>(`type`, `payload`): `void`

Defined in: packages/client/src/core/events/EventBus.ts:32

Emit a library event.

#### Type Parameters

##### T

`T` _extends_ [`LibraryEventType`](../type-aliases/LibraryEventType.md)

#### Parameters

##### type

`T`

Event type

##### payload

[`LibraryEventPayloads`](../interfaces/LibraryEventPayloads.md)\[`T`\]

Event payload

#### Returns

`void`

---

### on()

> **on**\<`T`\>(`type`): `Observable`\<[`LibraryEvent`](../interfaces/LibraryEvent.md)\<`T`\>\>

Defined in: packages/client/src/core/events/EventBus.ts:47

Get an observable filtered to a specific event type.

#### Type Parameters

##### T

`T` _extends_ [`LibraryEventType`](../type-aliases/LibraryEventType.md)

#### Parameters

##### type

`T`

Event type to filter for

#### Returns

`Observable`\<[`LibraryEvent`](../interfaces/LibraryEvent.md)\<`T`\>\>

Observable of events of that type

---

### onAny()

> **onAny**\<`T`\>(`types`): `Observable`\<[`LibraryEvent`](../interfaces/LibraryEvent.md)\<`T`\>\>

Defined in: packages/client/src/core/events/EventBus.ts:57

Get an observable filtered to multiple event types.

#### Type Parameters

##### T

`T` _extends_ [`LibraryEventType`](../type-aliases/LibraryEventType.md)

#### Parameters

##### types

`T`[]

Event types to filter for

#### Returns

`Observable`\<[`LibraryEvent`](../interfaces/LibraryEvent.md)\<`T`\>\>

Observable of events of those types
