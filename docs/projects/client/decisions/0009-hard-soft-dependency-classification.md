# ADR 0009 (client) — Hard/soft classification of `dependsOn` edges with source-tagged origins

**Status:** Proposed (created 2026-05-11)

## Context

[`CommandRecord.dependsOn`](../../../../packages/client/src/types/commands.ts) is currently a flat `string[]` of commandIds, populated at enqueue from three origins ([`CommandQueue.submit`](../../../../packages/client/src/core/command-queue/CommandQueue.ts)):

```ts
const allDeps = [...new Set([...explicitDeps, ...autoDeps, ...refCommandIds])]
```

- `refCommandIds` — derived from `commandIdPaths` (`EntityRef.commandId` values found at paths declared in `commandIdReferences`). See [ADR-0004](0004-aggregates-as-first-class.md).
- `autoDeps` — same-aggregate chain ordering, computed by `detectAggregateDependencies` from `affectedAggregates`.
- `explicitDeps` — the caller's literal `dependsOn: [...]` at submit.

Today every `dependsOn` edge is treated as hard at cascade time: if A fails, every dependent cancels ([§4.8.2](../intent/requirements/0004-command-queue.md#482-failure-category-taxonomy), [§4.8.3](../intent/requirements/0004-command-queue.md#483-pluggable-failure-mapping)). That policy is correct for identity-existence ("B's payload references an ID A creates") and for explicit caller-declared dependencies, but it over-cancels for the third class — two commands that share an aggregate chain but address unrelated state. The classic case: A unarchives a task, B changes a tag on a different task in the same notebook; both commands sit on the notebook's chain, A's failure should not cancel B.

The runtime cannot statically distinguish state-precondition hard ("A unarchived, B requires not-archived") from ordering-only soft ("A and B both touched the aggregate but address unrelated properties") — both produce the same `autoDeps` edge in the chain. Declarative state-precondition annotations were considered (see Alternatives) and rejected: permission state and similar real preconditions require async lookups that the queue's synchronous dispatch path cannot evaluate.

## Decision

Split `dependsOn` semantics so that hard cascade (cancel-all-dependents) applies only to edges the queue can prove are hard. Other edges default to soft (dependent attempts independently; server is the arbiter on failure).

### `dependsOn` becomes source-tagged

`CommandRecord.dependsOn: CommandDependency[]`:

```ts
type DependencySource = 'entity-ref' | 'aggregate-chain' | 'explicit'

interface CommandDependency {
  commandId: string
  source: DependencySource
}
```

The submit API does not change shape: `EnqueueCommand.dependsOn?: string[]` continues to accept a flat string array. The library tags caller-supplied entries as `source: 'explicit'` at enqueue.

`source` records _origin_, not _strength_. Strength is decided at cascade time from origin + (for `'aggregate-chain'`) a per-command-type classifier callback.

### Source precedence on dedup

When the same commandId appears via multiple origins, strictest-strength wins: `entity-ref > explicit > aggregate-chain`. Strongest known short-circuit wins.

### Strength rules at cascade time

| Source              | Strength                                                                |
| ------------------- | ----------------------------------------------------------------------- |
| `'entity-ref'`      | Hard. Classifier not consulted.                                         |
| `'explicit'`        | Hard. Classifier not consulted.                                         |
| `'aggregate-chain'` | Consult B's `classifyDependency` if registered; default soft if absent. |

Explicit `dependsOn` is hard, full stop — no escape hatch for "explicit but soft." A caller declaring `dependsOn: [cmdA]` on top of the auto-derived origins is by construction declaring consumer-domain knowledge that B requires A's effect.

### Per-command-type classifier on the registration

`CommandHandlerRegistration<TLink, TCommand, TSchema, TEvent>` gains an optional `classifyDependency`:

```ts
interface ClassifierInput<TLink, TCommand, TEvent> {
  command: CommandRecord<TLink, TCommand>
  events: TEvent[]
}

// Method shorthand (not property arrow) — see "Alternatives considered" below
// for why this distinction matters.
classifyDependency?(
  myCommand: ClassifierInput<TLink, C, IAnticipatedEvent>,
  dependsOnCommand: ClassifierInput<TLink, EnqueueCommand, IAnticipatedEvent>,
): 'hard' | 'soft'
```

- `myCommand` is statically narrowed to `C` — the registration's own command type from the distributive conditional. The classifier author can read `myCommand.command.data` typed to the registration's data shape without runtime narrowing.
- `dependsOnCommand` is typed broadly (`EnqueueCommand`) because the upstream A can be any registered command type. The author runtime-narrows on `dependsOnCommand.command.type` if specific upstream data matters.
- `events` arrays carry the broad `IAnticipatedEvent` shape on both sides. Keeping events at the broad shape decouples this field's variance from the registration's `TEvent` — see _Alternatives considered_ below.
- **Method shorthand, not property arrow.** Per-variant `C` in parameter position works because TypeScript checks method shorthand parameters bivariantly. A property arrow would force strict contravariance and fail under the same conditions the per-variant `C` succeeds here — the existing `handler` callback uses the same trick on the same registration.
- Synchronous return — cascade decisions fire synchronously; async return would complicate cascade-walk interleaving.
- Operates on pairs, not edges — A and B sharing multiple chains still dedupe to one entry and one classifier call.
- Events array semantics per status: anticipated when in-flight or non-success-terminal-with-events; persisted on success; empty for commands that failed at submit before generating events. The Command Queue retrieves these via `IAnticipatedEventHandler.getAnticipatedEvents(commandId)` (a new method on the lifecycle interface) and snapshots them at each layer of the cascade walk **before** the terminal-status transition fires `cleanupOnFailure` and purges the cache.
- Classifier throws propagate — consistent with how the existing `validate`/`validateAsync`/`handler` callbacks are treated. No silent fallback to a default would mask classifier bugs.

### Cascade semantics

When A reaches a terminal non-success status (`'failed'` _or_ `'cancelled'`), the queue walks A's dependents:

- **Hard** edge: dependent is cancelled. Status transition to `'cancelled'` triggers the existing non-success terminal cleanup in `batchUpdateCommandStatus`, which already calls `AggregateChainRegistry.onCommandCleanup` and detaches the now-cancelled dependent from its chains. Cascade continues into the dependent's own dependents.
- **Soft** edge: dependent is **not** cancelled. The queue removes A from the dependent's `blockedBy`; when `blockedBy` empties, the dependent transitions `'blocked'` → `'pending'` and proceeds. This is the same mechanic that runs today when a dep succeeds — soft-cascade reuses it on the failed-dep path. The cascade walk then fires a `processPendingCommands` to ensure the freshly-unblocked dependent is picked up in the same drain (the outer drain's snapshot was taken before the flip and would otherwise miss it).

Cascade walk is synchronous: it runs to completion as part of A's terminal-status transition, before any new submits or pending work is processed. State is observable at pre-walk and post-walk boundaries only.

### Chain stitching falls out for free

Hard cascade cancels B; B's transition to `'cancelled'` triggers the existing non-success terminal handler in `batchUpdateCommandStatus`, which already calls `onCommandCleanup` to detach B from its chains. When C's classifier is subsequently evaluated against A (mid-walk, after B has been detached), C sees a restitched chain — exactly what the design needs. No new chain-stitching code; the implementation only needs the cascade walk to drive B's status transition.

### Classifier evaluation is decision-time, not stored

The classifier runs at the moment a cascade decision is needed. Results are not persisted on the record. Dep state is allowed to change between evaluations (the read model, permission state, etc., may shift). Each evaluation is authoritative for that decision; earlier results don't constrain later ones. This makes "late-binding" dependencies fall out for free — any `dependsOn` edge present when cascade fires gets classified, whether it was added at enqueue or later.

### `blockedBy` stays `string[]`

Despite the name, `blockedBy` is not the inverse of `dependsOn` — it's a runtime-narrowed subset of `dependsOn` containing only the commandIds of deps still in non-terminal status. It drives the `'blocked'` → `'pending'` status flip. Source provenance lives only on `dependsOn`; when source is needed for a `blockedBy` entry, the dependent's own `dependsOn` record is the lookup target. The JSDoc on the field is corrected to match the actual semantic (it previously described the inverse).

### Pre-release migration

Per [ADR-0001](../../../decisions/0001-pre-release-no-back-compat.md) (pre-release: no back-compat shims), the schema change for `dependsOn` is taken as-is; users wipe OPFS data on update. No migration path is built.

## Consequences

### Implementation impact

- `CommandRecord.dependsOn` shape change from `string[]` to `CommandDependency[]` (origin-tagged).
- Source-tagging at enqueue: `entity-ref`, `aggregate-chain`, `explicit` — applied in `CommandQueue.submit` during the existing `[...explicitDeps, ...autoDeps, ...refCommandIds]` merge.
- Source precedence rule on dedup (`entity-ref > explicit > aggregate-chain`).
- Optional `classifyDependency?` method on `CommandHandlerRegistration` (method shorthand for bivariance — see Alternatives considered).
- New `IAnticipatedEventHandler.getAnticipatedEvents(commandId)` method to supply the events array for the classifier signature.
- Cascade walk: hard edges drive `'cancelled'` status transition (existing `batchUpdateCommandStatus` handler does chain cleanup); soft edges remove A from the dependent's `blockedBy` and fire `processPendingCommands` to drain the freshly-unblocked dependent in the same tick.
- JSDoc fix on `CommandRecord.blockedBy` (already landed).
- SQL storage round-trip update; fixtures; consumer code that reads `dependsOn` directly (per [ADR-0001](../../../decisions/0001-pre-release-no-back-compat.md), no migration path).
- Spec edits required and tracked alongside implementation: [`0004 §4.4`](../intent/requirements/0004-command-queue.md#44-command-record-schema), [§4.6.1](../intent/requirements/0004-command-queue.md#461-dependencies), [§4.8.2](../intent/requirements/0004-command-queue.md#482-failure-category-taxonomy), [§4.8.3](../intent/requirements/0004-command-queue.md#483-pluggable-failure-mapping), and [`0014 §14.6.1`](../intent/requirements/0014-entity-ref.md#1461-automatic-dependson). The exploration's reference to `§4.10` was based on an older section numbering; the cascade-on-conflict content now lives in §4.8.3 (the pluggable failure mapping section that also documents pipeline-time conflict routing).

### Operational implications

#### Gains

- The over-cancellation problem for ordering-only aggregate-chain edges is fixed. Soft dependents proceed and either succeed (the chain ordering didn't matter for their effect) or fail at the server (the server is the arbiter for genuine state-preconditions the classifier didn't catch).

#### Costs

- The cost of a real-hard misclassified as soft is N server round-trips and N server rejections instead of one local cancel. This is the deliberate failure mode — loud at the server boundary rather than silently absorbed.

### Coding implications

#### Gains

- The submit API stays `string[]`, so consumer call sites for `enqueue` / `submit` are unaffected by the storage-shape change.
- Existing registrations need no change to participate; `classifyDependency` is opt-in. Missing-classifier-equals-default-soft means no behavioural surprise for code that doesn't opt in.

#### Costs

- Consumers that today rely on hard-cancel-everything on aggregate-chain edges will see new soft behaviour; this is the intended change but requires registration-side opt-in via `classifyDependency` for the per-command-type domain logic that produces hard chain classifications.

## Alternatives considered

**Keep single-policy cascade (status quo).**
Simplest, no design work. Rejected because the over-cancellation is real — consumers writing apps with multi-command-per-aggregate workflows hit it directly (notebook tag changes cancelling all sibling notebook work when one tag command fails). The cost of leaving it in is paid every time a consumer designs around the over-cancel.

**Declarative state-preconditions per command (e.g., `requires: { archived: false }`).**
Most thorough; classifier becomes mechanical (the runtime checks the chain for state-changing commands that satisfy/violate the precondition). Rejected because real preconditions include permission state and other async-lookup-driven values that the queue's synchronous dispatch path cannot evaluate. Static capture would be a lie for the permission case, and trying to fake it would push brittleness somewhere worse. The classifier callback subsumes the case where preconditions are sync-derivable and gracefully degrades to "server is arbiter" where they're not.

**Strength stored on the edge.**
Storing `'hard' | 'soft'` directly on each `dependsOn` entry. Rejected because dep state can change between cascade evaluations — storing a strength snapshot would encode information the classifier is allowed to re-evaluate against current state. The exploration debated this directly and landed on storing _origin_ (which is immutable once recorded) rather than _strength_ (which is a function of current state).

**Single global `(A, B) → 'hard' | 'soft'` callback wired on `createCqrsClient`.**
Considered alongside per-command-type registration. Rejected because the relevant domain context lives on B (the dependent's command type) — it's where the registration author already knows the most about what B requires. A global callback forces a centralized dispatch on `(A.type, B.type)` pairs that scales poorly with the number of command types.

**Async classifier signature.**
Considered. Rejected because cascade fires synchronously off the terminal-status transition. Async classification would force the cascade walk to be async, which complicates interleaving with concurrent submits and the rest of the queue's synchronous dispatch.

**Explicit-but-soft escape hatch (e.g., `dependsOn: [{ commandId, soft: true }]`).**
Considered as a way to let callers express "wait for A but don't cancel me if A fails." Rejected for the first cut because the case is rare in practice and the explicit-is-hard guarantee is more valuable than the escape hatch. If a real case forces it, the natural shape is the wrapper object above; we'd revisit then rather than weakening the guarantee proactively.

**Property-arrow classifier signature with both args narrow (`ClassifierInput<TLink, C, TEvent>`).**
First attempt during implementation: `classifyDependency?: (myCommand: ClassifierInput<TLink, C, TEvent>, dependsOnCommand: ClassifierInput<TLink, C, TEvent>) => …` — both args narrow on the registration's per-variant `C` and outer `TEvent`. Failed at build: putting `TEvent` in a contravariant parameter position changed `CommandHandlerRegistration`'s variance in `TEvent` from covariant (only `handler`'s return previously touched it) to invariant. The variance shift broke executor factories that are themselves generic in `TEvent` — `IDomainExecutor<…, TEvent>` slots inferred a narrow `TEvent` at one site and a broad `TEvent` at another, and TS refused to unify them.

**Widen both arguments to the broadest `EnqueueCommand` / `IAnticipatedEvent` shape.**
Second attempt: fully broad both sides. Compiled cleanly, but the classifier author lost static narrowing on `myCommand` — every classifier had to runtime-guard `command.type` and cast `command.data`. The design intent (`myCommand` is the registration's command, `dependsOnCommand` is genuinely any) wasn't honored at the type level.

**Method-shorthand classifier with `myCommand` narrow on `C`, `dependsOnCommand` and events broad.** _What landed._
Switched the field declaration from property-arrow (`?: (…) => …`) to method shorthand (`?(…): …`) and dropped `TEvent` from parameter position entirely (`IAnticipatedEvent[]` on both events arrays). Method-shorthand parameters are checked bivariantly in TypeScript, so per-variant `C` from the distributive conditional satisfies a broad-`TCommand` slot when registrations flow through executor factories — the same mechanism the existing `handler` callback already relies on with `HandlerCommand<C['data']>`. The signature now reads naturally: `myCommand` is the registration's own type (narrow `C`), `dependsOnCommand` is any registered command type (broad `EnqueueCommand`). Events stay broad on both sides because keeping `TEvent` out of the signature is what fixes the TEvent variance regression; the events plumbing in the cascade walk supplies `IAnticipatedEvent[]` instances and the consumer can cast or narrow at runtime if they need event-shape specificity, which is rare. The bivariance relaxation is a known TypeScript escape valve for exactly this pattern; treating it as the intended tool here (rather than a hack) is consistent with how `handler` uses it on the same interface.

## Related

- Sourced from exploration: [`explorations/command-dependency-hard-soft-classification.md`](../explorations/command-dependency-hard-soft-classification.md). The exploration persists past this ADR's acceptance, trimmed to the open questions deferred for future work (cross-aggregate edges, chain snapshot on the classifier signature). Resolved content moves into this ADR; the alternatives-tried-and-rejected narrative during implementation also lives here, in Alternatives considered.
- Refines [§4.6.1 Dependencies](../intent/requirements/0004-command-queue.md#461-dependencies) and the cascade rules in [§4.8.2](../intent/requirements/0004-command-queue.md#482-failure-category-taxonomy) and [§4.8.3](../intent/requirements/0004-command-queue.md#483-pluggable-failure-mapping).
- Source-tagging of EntityRef-derived deps relates to [ADR-0004 (Aggregates as a first-class concept)](0004-aggregates-as-first-class.md) and [`§14.6.1`](../intent/requirements/0014-entity-ref.md#1461-automatic-dependson).
