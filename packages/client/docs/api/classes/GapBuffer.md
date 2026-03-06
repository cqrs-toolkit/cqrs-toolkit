[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / GapBuffer

# Class: GapBuffer\<TEvent\>

Defined in: [packages/client/src/core/event-cache/GapDetector.ts:89](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/event-cache/GapDetector.ts#L89)

Gap buffer for accumulating events while waiting for gap repair.

## Type Parameters

### TEvent

`TEvent` = `unknown`

## Constructors

### Constructor

> **new GapBuffer**\<`TEvent`\>(): `GapBuffer`\<`TEvent`\>

#### Returns

`GapBuffer`\<`TEvent`\>

## Methods

### add()

> **add**(`streamId`, `position`, `event`): `boolean`

Defined in: [packages/client/src/core/event-cache/GapDetector.ts:101](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/event-cache/GapDetector.ts#L101)

Add an event to the buffer.

#### Parameters

##### streamId

`string`

Stream identifier (or 'global' for cross-stream)

##### position

`bigint`

Event position

##### event

`TEvent`

The event data

#### Returns

`boolean`

Whether this created a new gap

---

### clear()

> **clear**(): `void`

Defined in: [packages/client/src/core/event-cache/GapDetector.ts:170](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/event-cache/GapDetector.ts#L170)

Clear all buffered events.

#### Returns

`void`

---

### clearStream()

> **clearStream**(`streamId`): `void`

Defined in: [packages/client/src/core/event-cache/GapDetector.ts:162](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/event-cache/GapDetector.ts#L162)

Clear all buffered events and known positions for a single stream.

#### Parameters

##### streamId

`string`

Stream identifier

#### Returns

`void`

---

### clearUpTo()

> **clearUpTo**(`streamId`, `upToPosition`): `void`

Defined in: [packages/client/src/core/event-cache/GapDetector.ts:145](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/event-cache/GapDetector.ts#L145)

Clear events for a stream up to a position.

#### Parameters

##### streamId

`string`

Stream identifier

##### upToPosition

`bigint`

Clear events with position <= this

#### Returns

`void`

---

### getEvents()

> **getEvents**(`streamId`): `object`[]

Defined in: [packages/client/src/core/event-cache/GapDetector.ts:132](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/event-cache/GapDetector.ts#L132)

Get all buffered events for a stream, sorted by position.

#### Parameters

##### streamId

`string`

Stream identifier

#### Returns

`object`[]

Sorted events

---

### getGaps()

> **getGaps**(): `Map`\<`string`, [`EventGap`](../interfaces/EventGap.md)[]\>

Defined in: [packages/client/src/core/event-cache/GapDetector.ts:180](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/event-cache/GapDetector.ts#L180)

Get detected gaps for all streams.

#### Returns

`Map`\<`string`, [`EventGap`](../interfaces/EventGap.md)[]\>

Map of stream ID to gaps

---

### setKnownPosition()

> **setKnownPosition**(`streamId`, `position`): `void`

Defined in: [packages/client/src/core/event-cache/GapDetector.ts:201](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/event-cache/GapDetector.ts#L201)

Set the known highest position for a stream.
Used when resuming from persisted state.

#### Parameters

##### streamId

`string`

Stream identifier

##### position

`bigint`

Known highest position

#### Returns

`void`
