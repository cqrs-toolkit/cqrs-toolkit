[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../README.md) / EventGap

# Interface: EventGap

Defined in: packages/client/src/core/event-cache/GapDetector.ts:9

Represents a gap in the event sequence.

## Properties

### fromPosition

> **fromPosition**: `bigint`

Defined in: packages/client/src/core/event-cache/GapDetector.ts:11

Start position (exclusive - last known good position)

---

### streamId?

> `optional` **streamId**: `string`

Defined in: packages/client/src/core/event-cache/GapDetector.ts:15

Stream ID if the gap is stream-specific

---

### toPosition

> **toPosition**: `bigint`

Defined in: packages/client/src/core/event-cache/GapDetector.ts:13

End position (exclusive - first known position after gap)
