[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / DomainExecutionSuccess

# Interface: DomainExecutionSuccess\<TEvent\>

Defined in: [packages/client/src/types/domain.ts:32](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/types/domain.ts#L32)

Successful domain execution payload.

## Type Parameters

### TEvent

`TEvent`

## Properties

### anticipatedEvents

> **anticipatedEvents**: `TEvent`[]

Defined in: [packages/client/src/types/domain.ts:34](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/types/domain.ts#L34)

Events to apply optimistically

---

### postProcessPlan?

> `optional` **postProcessPlan**: [`PostProcessPlan`](PostProcessPlan.md)

Defined in: [packages/client/src/types/domain.ts:36](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/types/domain.ts#L36)

Optional post-processing instructions
