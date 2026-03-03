[**@cqrs-toolkit/client**](../README.md)

***

[@cqrs-toolkit/client](../globals.md) / DomainExecutionSuccess

# Interface: DomainExecutionSuccess\<TEvent\>

Defined in: packages/client/src/types/domain.ts:32

Successful domain execution payload.

## Type Parameters

### TEvent

`TEvent`

## Properties

### anticipatedEvents

> **anticipatedEvents**: `TEvent`[]

Defined in: packages/client/src/types/domain.ts:34

Events to apply optimistically

***

### postProcessPlan?

> `optional` **postProcessPlan**: [`PostProcessPlan`](PostProcessPlan.md)

Defined in: packages/client/src/types/domain.ts:36

Optional post-processing instructions
