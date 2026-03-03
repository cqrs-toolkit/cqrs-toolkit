[**@cqrs-toolkit/client**](../README.md)

***

[@cqrs-toolkit/client](../globals.md) / GapBuffer

# Class: GapBuffer\<TEvent\>

Defined in: packages/client/src/core/event-cache/GapDetector.ts:89

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

Defined in: packages/client/src/core/event-cache/GapDetector.ts:101

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

***

### clear()

> **clear**(): `void`

Defined in: packages/client/src/core/event-cache/GapDetector.ts:160

Clear all buffered events.

#### Returns

`void`

***

### clearUpTo()

> **clearUpTo**(`streamId`, `upToPosition`): `void`

Defined in: packages/client/src/core/event-cache/GapDetector.ts:145

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

***

### getEvents()

> **getEvents**(`streamId`): `object`[]

Defined in: packages/client/src/core/event-cache/GapDetector.ts:132

Get all buffered events for a stream, sorted by position.

#### Parameters

##### streamId

`string`

Stream identifier

#### Returns

`object`[]

Sorted events

***

### getGaps()

> **getGaps**(): `Map`\<`string`, [`EventGap`](../interfaces/EventGap.md)[]\>

Defined in: packages/client/src/core/event-cache/GapDetector.ts:170

Get detected gaps for all streams.

#### Returns

`Map`\<`string`, [`EventGap`](../interfaces/EventGap.md)[]\>

Map of stream ID to gaps

***

### setKnownPosition()

> **setKnownPosition**(`streamId`, `position`): `void`

Defined in: packages/client/src/core/event-cache/GapDetector.ts:191

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
