[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / domainSuccess

# Function: domainSuccess()

> **domainSuccess**\<`TEvent`\>(`anticipatedEvents`, `postProcessPlan?`): [`DomainExecutionResult`](../type-aliases/DomainExecutionResult.md)\<`TEvent`\>

Defined in: [packages/client/src/types/domain.ts:91](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/types/domain.ts#L91)

Helper to create a successful domain execution result.

## Type Parameters

### TEvent

`TEvent`

## Parameters

### anticipatedEvents

`TEvent`[]

### postProcessPlan?

[`PostProcessPlan`](../interfaces/PostProcessPlan.md)

## Returns

[`DomainExecutionResult`](../type-aliases/DomainExecutionResult.md)\<`TEvent`\>
