[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / isDomainSuccess

# Function: isDomainSuccess()

> **isDomainSuccess**\<`TEvent`\>(`outcome`): `outcome is { events: TEvent[]; kind: "success"; postProcessPlan?: PostProcessPlan }`

Type guard for the success variant of a domain execution outcome.

Discriminator-based narrowing (`if (outcome.kind === 'success')`) is the
idiomatic dispatch; this predicate is shipped for symmetry with existing
`is*` helpers and for use in array filters where inline narrowing is awkward.

## Type Parameters

### TEvent

`TEvent`

## Parameters

### outcome

[`DomainExecutionOutcome`](../type-aliases/DomainExecutionOutcome.md)\<`TEvent`\>

## Returns

`outcome is { events: TEvent[]; kind: "success"; postProcessPlan?: PostProcessPlan }`
