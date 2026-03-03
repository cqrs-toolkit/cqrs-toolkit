[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../README.md) / DomainExecutionSuccess

# Interface: DomainExecutionSuccess\<TEvent\>

Defined in: packages/client/src/types/domain.ts:24

Successful domain execution result.

## Type Parameters

### TEvent

`TEvent`

## Properties

### anticipatedEvents

> **anticipatedEvents**: `TEvent`[]

Defined in: packages/client/src/types/domain.ts:27

Events to apply optimistically

---

### ok

> **ok**: `true`

Defined in: packages/client/src/types/domain.ts:25

---

### postProcessPlan?

> `optional` **postProcessPlan**: [`PostProcessPlan`](PostProcessPlan.md)

Defined in: packages/client/src/types/domain.ts:29

Optional post-processing instructions
