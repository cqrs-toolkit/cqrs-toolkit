[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / EventGap

# Interface: EventGap

Represents a gap in the event sequence.

## Properties

### fromPosition

> **fromPosition**: `bigint`

Start position (exclusive - last known good position)

---

### streamId?

> `optional` **streamId**: `string`

Stream ID if the gap is stream-specific

---

### toPosition

> **toPosition**: `bigint`

End position (exclusive - first known position after gap)
