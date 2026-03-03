[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../README.md) / GapDetectionResult

# Interface: GapDetectionResult

Defined in: packages/client/src/core/event-cache/GapDetector.ts:21

Gap detection result.

## Properties

### gaps

> **gaps**: [`EventGap`](EventGap.md)[]

Defined in: packages/client/src/core/event-cache/GapDetector.ts:25

List of detected gaps

---

### hasGaps

> **hasGaps**: `boolean`

Defined in: packages/client/src/core/event-cache/GapDetector.ts:23

Whether there are any gaps

---

### highestPosition

> **highestPosition**: `bigint`

Defined in: packages/client/src/core/event-cache/GapDetector.ts:27

Highest position seen
