[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / CommandDependency

# Interface: CommandDependency

A single edge in [CommandRecord.dependsOn](CommandRecord.md#dependson), tagged with the origin
that produced it. The `source` informs the cascade walk how to treat the
edge when the dependency reaches a non-success terminal status — see
[DependencySource](../type-aliases/DependencySource.md). Multiple origins for the same `commandId`
collapse to one entry under the strictest-strength rule:
`entity-ref > explicit > aggregate-chain`.

## Properties

### commandId

> **commandId**: `string`

---

### source

> **source**: [`DependencySource`](../type-aliases/DependencySource.md)
