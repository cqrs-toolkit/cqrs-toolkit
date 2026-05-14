[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / DependencySource

# Type Alias: DependencySource

> **DependencySource** = `"entity-ref"` \| `"aggregate-chain"` \| `"explicit"`

Origin of a [CommandDependency](../interfaces/CommandDependency.md) entry. Determines whether the cascade
walk consults the dependent's `classifyDependency` callback at decision time
or short-circuits to a known strength.

- `'entity-ref'`: derived from an `EntityRef.commandId` at a path declared in
  `commandIdReferences`. Always **hard** — B's payload references an id A
  creates; if A doesn't land, B's reference has no meaning.
- `'explicit'`: caller wrote `dependsOn: [...]` at submit. Always **hard** —
  the caller has out-of-band domain knowledge that B requires A's effect.
  Soft same-aggregate ordering is expressed by _not_ declaring the dep.
- `'aggregate-chain'`: auto-derived from same-aggregate ordering. The queue
  cannot decide hard vs soft on its own; the dependent's
  `classifyDependency` callback (if registered) decides; default is soft.
