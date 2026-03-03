[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../README.md) / detectGaps

# Function: detectGaps()

> **detectGaps**(`positions`, `knownHighest?`): [`GapDetectionResult`](../interfaces/GapDetectionResult.md)

Defined in: packages/client/src/core/event-cache/GapDetector.ts:37

Detect gaps in a sequence of positions.

## Parameters

### positions

`bigint`[]

Array of positions (can be unsorted)

### knownHighest?

`bigint`

Previously known highest position (for detecting leading gaps)

## Returns

[`GapDetectionResult`](../interfaces/GapDetectionResult.md)

Gap detection result
