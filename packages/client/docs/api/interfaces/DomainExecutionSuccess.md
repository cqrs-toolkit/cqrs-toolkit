[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / DomainExecutionSuccess

# Interface: DomainExecutionSuccess\<TEvent\>

Successful domain execution payload.

## Type Parameters

### TEvent

`TEvent`

## Properties

### anticipatedEvents

> **anticipatedEvents**: `TEvent`[]

Events to apply optimistically

---

### postProcessPlan?

> `optional` **postProcessPlan**: [`PostProcessPlan`](PostProcessPlan.md)

Optional post-processing instructions
