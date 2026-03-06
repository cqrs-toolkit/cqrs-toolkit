[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / EventBus

# Class: EventBus

Defined in: [packages/client/src/core/events/EventBus.ts:13](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/events/EventBus.ts#L13)

Event bus for library-level events.
All components can emit events, and consumers can subscribe to specific event types.

## Constructors

### Constructor

> **new EventBus**(): `EventBus`

Defined in: [packages/client/src/core/events/EventBus.ts:21](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/events/EventBus.ts#L21)

#### Returns

`EventBus`

## Properties

### events$

> `readonly` **events$**: `Observable`\<[`LibraryEvent`](../interfaces/LibraryEvent.md)\<[`LibraryEventType`](../type-aliases/LibraryEventType.md)\>\>

Defined in: [packages/client/src/core/events/EventBus.ts:19](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/events/EventBus.ts#L19)

Observable of all library events.

## Methods

### complete()

> **complete**(): `void`

Defined in: [packages/client/src/core/events/EventBus.ts:67](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/events/EventBus.ts#L67)

Complete the event bus.
Should be called when the client is destroyed.

#### Returns

`void`

---

### emit()

> **emit**\<`T`\>(`type`, `payload`): `void`

Defined in: [packages/client/src/core/events/EventBus.ts:32](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/events/EventBus.ts#L32)

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

Defined in: [packages/client/src/core/events/EventBus.ts:47](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/events/EventBus.ts#L47)

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

Defined in: [packages/client/src/core/events/EventBus.ts:57](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/events/EventBus.ts#L57)

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
