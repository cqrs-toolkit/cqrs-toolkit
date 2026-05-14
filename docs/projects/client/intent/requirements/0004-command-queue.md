# 4\. Command Queue (Resilient Command Pipeline)

## 4.1 Purpose

The Command Queue is responsible for **persisting, sequencing, retrying, and reconciling commands** issued by the client until they are successfully processed by the server or explicitly resolved.

It enables:

- offline command capture

- optimistic UI updates via anticipated events

- safe retry and resume across reloads, crashes, and connectivity loss

- deterministic reconciliation with authoritative server results

The Command Queue is the **only component** that invokes the Domain Layer to execute commands.

---

## 4.2 Core principles and constraints

### 4.2.1 Read-model independence

Commands:

- must **never depend on local read model data**

- must remain valid even if:
  - no cache keys are loaded

  - all cached data has been evicted

- may be issued while offline or before authentication is confirmed

This ensures:

- cache eviction does not invalidate pending commands

- command correctness is not coupled to UI state or caching decisions

---

### 4.2.2 Persistence and durability

- In offline-support mode, all enqueued commands are persisted.

- Commands survive:
  - page reloads

  - browser restarts

  - offline periods

- In online-only mode, commands are stored in memory only.

---

## 4.3 Responsibilities

The Command Queue is responsible for:

- Persisting commands and execution metadata

- Managing command dependencies and execution order

- Retrying failed commands with backoff

- Producing anticipated events via the Domain Layer

- Writing anticipated events into the Event Cache

- Reconciling anticipated events with server responses

- Emitting command lifecycle events

The Command Queue does **not**:

- read from the Read Model Store

- manage cache keys or eviction

- perform network I/O directly

- infer or manage authentication state

---

## 4.4 Command record schema

Each persisted command record (`CommandRecord<TLink, TCommand, TResponse>`) includes:

**Identity and routing:**

- `commandId: string` — client-generated, stable identifier.
- `cacheKey: CacheKeyIdentity<TLink>` — the cache key that scopes this command's anticipated events and response events. Persisted as JSON in SQL storage.
- `service: string` — target service for the command.
- `type: string` — command type (e.g. `CreateTodo`).
- `data: object` — command payload.
- `path?: unknown` — URL path template values for command-sender URL expansion.
- `headers?: Record<string, EntityId>` — escape-hatch envelope headers (e.g. `x-tenant-id`, propagation hints). Values are `EntityId` (string | `EntityRef`); declared `EntityRef` positions (see [0014 §14.5.7](0014-entity-ref.md#1457-envelope-headers)) ride through to the record and the handler, and the cascade rewrites them to server-id strings when the producing command resolves. Submit-time gate: an `EntityRef` at a header path **not** declared in `commandIdReferences` is rejected with a package-local `assert`. At the send boundary the queue narrows the type to `Record<string, string>` — see [§4.4.4](#444-send-boundary).

**Lifecycle:**

- `status: 'pending' | 'blocked' | 'sending' | 'succeeded' | 'applied' | 'failed' | 'cancelled'`
  - `'succeeded'` — server confirmed; effects not yet reflected in `serverData`.
  - `'applied'` — pipeline-owned post-terminal state. The sync pipeline transitions `'succeeded'` → `'applied'` after observing either the command's response events or per-aggregate revision/eviction coverage. Terminal-status checks (file cleanup, chain detachment, `waitForSucceeded`) fire at `'succeeded'`; `'applied'` is post-terminal and not part of `TerminalCommandStatus`.
- `attempts: number`
- `lastAttemptAt?: number`
- `error?: IException` — present on failed commands. Carries a `category: FailureCategory` field ([§4.8.2](#482-failure-category-taxonomy)) that drives retry, user-intervention, and cancellation decisions; UI consumers switch on `category` rather than parsing status codes. The exception itself is a typed instance from `@meticoeus/ddd-es` (`CommandFailedException`, `ConflictException`, etc.).
- `serverResponse?: TResponse` — set on success.

**Dependencies:**

- `dependsOn: CommandDependency[]` — source-tagged edges this command waits for. Each entry is `{ commandId, source }` where `source: 'entity-ref' | 'aggregate-chain' | 'explicit'` records which origin produced the edge (see [§4.6.1](#461-dependencies) for the three origins and the cascade semantics that depend on the tag). Auto-derived from `EntityRef.commandId` values in command data ([0014 §14.6.1](0014-entity-ref.md#1461-automatic-dependson)) and from same-aggregate ordering; explicit declarations remain available for non-EntityRef ordering constraints. The submit-time API (`EnqueueCommand.dependsOn?: string[]`) stays a flat string array; the library tags entries with `'explicit'` at enqueue and merges them with auto-derived origins under the precedence rule in [§4.6.1](#461-dependencies).
- `blockedBy: string[]` — runtime-narrowed subset of `dependsOn` commandIds still gating this command (those that have not yet reached terminal status). Entries drop off as deps complete; when this list empties, status flips from `'blocked'` to `'pending'`. Stored flat — the source for any entry here can be looked up by joining with the matching `dependsOn` record.

**Bookkeeping:**

- `seq: number` — sequence number for stable submit-order sorting. SQL autoincrement is authoritative on disk; the value is read-only from the storage perspective.
- `createdAt: number`
- `updatedAt: number`

### 4.4.1 EntityRef and aggregate integration fields

- `creates?: CreateCommandConfig` — present only for commands that create an aggregate. Carries `{ eventType, idStrategy }` declaring which response event type carries the server-assigned ID and whether the client-generated ID is `'temporary'` or `'permanent'` (see [0014 §14.4](0014-entity-ref.md#144-id-strategy)).
- `affectedAggregates?: AffectedAggregate<TLink>[]` — derived at enqueue time. Each entry carries the canonical `streamId` (chain/concurrency key) and an `EntityId`-aware `TLink` for reconciliation across `EntityRef` lifecycles. See [0015](0015-aggregate-config.md).
- `commandIdPaths?: Record<JSONPathExpression, EntityRef>` — resolved JSONPath positions of `EntityRef` values in the command record, captured at enqueue time. Keyed by JSONPath rooted at the command object (e.g. `$.data.notebookId`, `$.path.id`, `$.headers['x-tenant-id']`). Used to strip and restore `EntityRef` values for storage and handler re-runs, derive auto-dependencies from `ref.commandId`, and prune entries as temporary IDs resolve to server IDs (see [0014 §14.5.2](0014-entity-ref.md#1452-command-submission-entityref-extraction-point) and [§14.5.7](0014-entity-ref.md#1457-envelope-headers)).
- `postProcess?: PostProcessPlan` — optional generic post-processing instructions from the domain executor (`{ kind, tempIds? }`). EntityRef-driven field rewriting ([`0014 §14.6.2`](0014-entity-ref.md#1462-automatic-field-rewriting)) and aggregate-config-driven ID reconciliation ([`0015 §15.3`](0015-aggregate-config.md#153-reconciliation)) are auto-wired and do not require explicit `postProcess` entries.

### 4.4.2 Submit-time inputs

- `revision?: string | AutoRevision` — provided by the consumer for mutate commands; absent for creates. `AutoRevision` is a serializable marker the library resolves before send (substituting the read model's current revision, with optional fallback).
- `modelState?: unknown` — read-model snapshot the user had when the command was submitted. Captured at submit time, **persisted durably** in the command record (survives reload), and immutable thereafter. The Command Queue does not read the Read Model Store at runtime — this snapshot is consumer-passed at enqueue and persisted with the command record ([§4.3](#43-responsibilities)).

  This persisted value is the **`initial`** field of the `HandlerState` discriminated union the command-level handler functions (`validate`, `validateAsync`, `handler`) receive. On the first call (at enqueue), `state` is `{ mode: 'initial', initial }`. On every subsequent invocation — server-event delta during reconciliation, id-rewrite cascade after a parent command resolves, AutoRevision resolution — `state` is `{ mode: 'regenerate', initial, current }`, where `current` is the latest read-model view of the command's primary entity at the moment of regenerate. The library always populates `current` so handler behavior is consistent across triggers; handlers don't have to special-case why they were re-invoked.

  The conceptual contract is documented in [`0002 §2.4`](0002-domain-layer.md#24-public-contract-conceptual). Event Processors ([`0008`](0008-event-processors.md)) are out of scope for this shape change — they are entity-level reducers, not command-level functions, and their `state: TModel | undefined` argument stays as-is.

### 4.4.3 File attachments

- `fileRefs?: FileRef[]` — file attachment metadata. At rest, each `FileRef.data` is undefined; the library hydrates `data: Blob` before send. See [§4.14](#414-file-upload-commands) for the full file-upload model.

### 4.4.4 Send boundary

`ICommandSender.send` receives a `SendableCommandRecord<TLink, TCommand, TResponse>` — identical to `CommandRecord` except `headers` is narrowed to `Record<string, string>`.
The narrowing is the runtime consequence of two upstream invariants:

- the submit gate rejects `EntityRef`s at undeclared header paths ([0014 §14.5.7](0014-entity-ref.md#1457-envelope-headers));
- declared `EntityRef` headers are rewritten in place to server-id strings by the cascade ([0014 §14.6.2](0014-entity-ref.md#1462-automatic-field-rewriting)) before the command becomes unblocked.

Just before invoking the sender, the queue asserts every header value is a plain string with the package-local `assert`. A non-string at this point is a library bug (a missed cascade rewrite); the assert surfaces it loudly rather than silently coercing. Transports never have to flatten or coerce header values.

---

## 4.5 Session and user identity handling

### 4.5.1 Session scoping

- The Command Queue is scoped to the **current session user**.

- At any time, all commands in the queue belong to exactly one user.

- Commands are not shared across sessions.

---

### 4.5.2 Offline-first startup

- The library may initialize with authentication state unknown.

- Commands from the last session (if any) are loaded and retained.

- Commands must **not** be sent to the server until authentication is confirmed.

This allows:

- offline command entry

- inspection of pending commands while offline

---

### 4.5.3 User identity change handling

When the application signals authentication with a `userId` that differs from the persisted session user:

- the library must perform a **full local data wipe**

- this wipe **includes the Command Queue**

- all pending, blocked, or failed commands are deleted

- all associated anticipated events are discarded

- a new empty Command Queue is initialized for the new user

No command from a previous user may be retained or executed.

---

## 4.6 Dependency and post-processing model

### 4.6.1 Dependencies

Commands may declare dependencies via `dependsOn`.
A command may not transition to `sending` until all dependencies have reached terminal status (success path; the soft-cascade path below also allows a chain-only dependent to proceed when its dep terminates non-success).

**Origins.** Each `CommandDependency` entry carries an explicit `source` so the cascade walk ([§4.8.2](#482-failure-category-taxonomy)) can decide whether the edge propagates a cancellation. Three origins:

| Origin              | Where it comes from                                                                                                               | Strength on cascade                                                                                                                                                                                                                    |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `'entity-ref'`      | `EntityRef.commandId` resolved at a `commandIdReferences` path (see [0014 §14.6.1](0014-entity-ref.md#1461-automatic-dependson)). | **Hard** by construction — the dependent's payload references an id this create produces. If the create doesn't land, the reference has no meaning.                                                                                    |
| `'explicit'`        | Consumer-declared in `EnqueueCommand.dependsOn` at submit. The library tags those entries `'explicit'` at enqueue.                | **Hard**. A caller writing `dependsOn: [...]` has gone out of their way to declare an ordering the library wouldn't otherwise derive — by construction the case where the caller knows the dependent requires the dependency's effect. |
| `'aggregate-chain'` | Auto-derived from same-aggregate ordering (commands touching the same aggregate chain via `affectedAggregates`).                  | **Classified at cascade time.** The dependent's `CommandHandlerRegistration.classifyDependency` returns `'hard'` or `'soft'`; default when no classifier is registered is **soft**.                                                    |

The submit-time API (`EnqueueCommand.dependsOn?: string[]`) stays a flat string array. Consumers do not write the wrapper.

**Source precedence on collision.** When the same `commandId` would be produced by multiple origins for the same command, the stored entry carries the strongest source: `entity-ref > explicit > aggregate-chain`. Concretely:

- `entity-ref` + `aggregate-chain` → stored as `entity-ref` (the chain edge is redundant under the EntityRef signal).
- `explicit` + `aggregate-chain` → stored as `explicit` (the caller's deliberate declaration outranks chain-derived ordering).
- `entity-ref` + `explicit` (rare) → stored as `entity-ref`. Both short-circuit to hard, so the classification outcome is identical; the picked source is the more specific signal for debugging/logging.

The stored `source` is the **origin**, not a separate strength field. The classifier still owns hard/soft for `'aggregate-chain'` entries; `source` provides the short-circuit when origin alone determines hardness.

**Why `'explicit'` is always hard.** Soft same-aggregate ordering is expressed by _not_ declaring the dep and letting the chain handle it. There is no escape hatch for "explicit but soft" — explicit is always hard, full stop. If a soft cross-aggregate case appears that the existing origins can't express, the library would revisit by adding a declarative form rather than weakening the explicit-is-hard guarantee.

**Missing-declaration handling.** A real state-precondition hard that the classifier doesn't catch becomes soft → dependent attempts → server rejects → the dependent fails with the normal failure pathway. Loud, late, but recovered correctly. Misclassifying a real hard as soft costs N server round-trips and N rejections instead of one local cancel — that is the deliberate failure mode, loud at the server boundary rather than silently absorbed. The opposite (silent over-cancel) is the failure mode the hard/soft split exists to avoid.

---

### 4.6.2 Post-processing

When a command succeeds, the Command Queue reconciles its temporary IDs with the server-assigned IDs and propagates the changes to dependent commands and their anticipated events.

Reconciliation is driven by declarative path metadata on the command handler registration:

- `commandIdReferences` declares JSONPath positions in the command (`$.data.*`, `$.path.*`) where entity IDs appear, paired with the `AggregateConfig` each ID belongs to. The `EntityRef.commandId` on each value identifies the producing create command, which feeds both auto-`dependsOn` ([§4.6.1](#461-dependencies)) and field rewriting on reconcile.
- `responseIdReferences` declares JSONPath positions in the server response where server-assigned IDs appear, paired with the same `AggregateConfig`. The library walks both sides, builds a `clientId → serverId` map, and rewrites pending command data and anticipated events accordingly. When neither `responseIdReferences` nor `responseIdMapping` is provided and the registration names a primary `aggregate`, the library auto-populates `responseIdReferences` with `[{ aggregate, path: '$.id', revisionPath: '$.nextExpectedRevision' }]`.
- `responseIdMapping?(ctx)` is a callback alternative for computing the mapping from arbitrary response shapes (computed ids, response events, multi-step logic).

See [0014 §14.6.2](0014-entity-ref.md#1462-automatic-field-rewriting) and [0015 §15.3](0015-aggregate-config.md#153-reconciliation).

The generic `postProcess?: PostProcessPlan` field on the command record ([§4.4.1](#441-entityref-and-aggregate-integration-fields)) is reserved for non-aggregate post-processing concerns; EntityRef and aggregate-driven reconciliation does not require explicit `postProcess` entries.

Reconciliation must be deterministic and idempotent.

---

## 4.7 Anticipated event handling

- Anticipated events are produced by executing the Domain Layer.

- They:
  - match server event **type names and overall payload shape**, with one exception: ID fields referencing locally-created entities may carry `EntityRef` values per [0014 §14.5.1](0014-entity-ref.md#1451-entityref-in-anticipated-events), where server-originated events always carry plain strings

  - omit server-only fields (e.g., `position`)

  - are associated with a `commandId`

- Anticipated events are written to the Event Cache and applied wherever relevant cached data exists.

Anticipated events:

- may affect currently cached data

- may affect data loaded later

- remain valid regardless of cache eviction

When a command succeeds or is cancelled, the Command Queue is responsible for ensuring associated anticipated events are removed or rebased.

### 4.7.1 Handler state input — first call vs regenerate

The command-level handler functions (`validate`, `validateAsync`, `handler`) receive a discriminated-union `state: HandlerState`:

- **`{ mode: 'initial', initial }`** — first invocation, at enqueue. `initial` is the snapshot the consumer passed to `submit({ ..., modelState })`. The handler produces the optimistic anticipated event(s) against `initial`.

- **`{ mode: 'regenerate', initial, current }`** — any subsequent invocation. `initial` is unchanged across regenerates. `current` is the latest read-model view of the command's primary entity at the moment of regenerate, populated consistently regardless of what triggered the regenerate:
  - **Reconcile after a server-event delta** ([`0005 §5.6`](0005-sync-manager.md#56-permanent-event-handling-ordering--gap-repair)) — `current` is the post-server-event baseline of the entity from the reconcile fold (pure server truth with no client overlays mixed in; chain continuity for downstream dirty commands is preserved through the fold's `clientState` output, not through handler input).
  - **Id-rewrite cascade** after a parent command's create resolved its temp id to a server id — `current` is `readModelStore.getById(collection, entityId).data`.
  - **AutoRevision resolution** after a dependency succeeded with a revision — `current` is the same store-fetched view.

  `current` is `T | undefined`; it can be `undefined` only when the entity isn't yet in the read-model store (no overlay folded yet, outside active cache) — never as a "trigger-based" signal.

A handler that compares `initial` and `current` can detect "the field I was editing has been changed by someone else since I queued my edit." A handler that doesn't care about the comparison can read `state.mode === 'regenerate' ? (state.current ?? state.initial) : state.initial` as "the most current view available."

A handler that detects a conflict against `current` returns a `'conflict'`-kinded `DomainExecutionOutcome` with a `category: FailureCategory` ([§4.8](#48-retry-and-failure-handling)). The Command Queue persists the command and routes the conflict's category through the same dispatch as server-derived categories.

---

## 4.8 Retry and failure handling

Failure handling is driven by a typed `FailureCategory` that classifies _why_ a command failed. The category determines retry, user-intervention, and cancellation behaviour, and is visible to the UI on the persisted exception so consumers don't string-match status codes.

### 4.8.1 Retry policy

- Retry is gated by `category === 'transient'`. Other categories never auto-retry.
- Recommended retry behaviour for transient failures: exponential backoff with jitter, bounded attempt count.
- Dependency ordering must always be preserved across retries.
- The category-based retry rule subsumes the prior boolean `isRetryable` flag — `isRetryable` remains as a derived alias (`category === 'transient'`) for source compatibility.

### 4.8.2 Failure category taxonomy

`FailureCategory` is a string-literal union, designed to be extended as new behaviours emerge. Adding a member is a single edit; the compiler enforces exhaustive handling at every dispatch site.

| Category              | Meaning                                                                                                                                | Library response                                                                                                                                                                    |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `'transient'`         | Network blip, server-side glitch the client should retry through.                                                                      | Retry per [§4.8.1](#481-retry-policy).                                                                                                                                              |
| `'requires-review'`   | The user needs to make a decision (server conflict, validation rejection, stale-data conflict the handler detected during regenerate). | Command terminates as `'failed'` with `category` accessible to the UI; UI prompts. Hard-and-soft cascade per the rule below. (A dedicated lifecycle status is a future graduation.) |
| `'redundant'`         | The user's intent is already satisfied (duplicate edit, idempotent no-op — the world is already in the desired state).                 | Command terminates as `'failed'` with `category: 'redundant'`; UI silently dismisses. Hard-and-soft cascade per the rule below. (Auto-cleanup is a future graduation.)              |
| `'unauthenticated'`   | Session expired / not signed in.                                                                                                       | Command terminates as `'failed'`; UI prompts re-auth. Hard-and-soft cascade per the rule below. (Hold-and-retry-after-reauth is a future graduation.)                               |
| `'permission-denied'` | Authenticated but not authorized for this action.                                                                                      | Command terminates as `'failed'`; hard-and-soft cascade per the rule below.                                                                                                         |
| `'permanent'`         | Invalid in a way the user can't fix (typically a client/protocol bug).                                                                 | Command terminates as `'failed'`; hard-and-soft cascade per the rule below.                                                                                                         |

Categories distinguish UX decisions, not transport details: `'unauthenticated'` (re-auth fixes it) is intentionally distinct from `'permission-denied'` (re-auth does not), and `'redundant'` is distinct from `'requires-review'` because nothing needs reviewing.

**Hard-and-soft cascade rule.** When a command reaches a terminal non-success status — any non-`'transient'` failure, a user-initiated cancellation via `cancelCommand`, or a cancellation propagated from an upstream cascade — the Command Queue walks the command's direct dependents and classifies each edge per [§4.6.1](#461-dependencies):

- **Hard dependents** (`source: 'entity-ref'` or `source: 'explicit'`, or `source: 'aggregate-chain'` with the dependent's `classifyDependency` returning `'hard'`) auto-cancel. The walk recurses into their dependents.
- **Soft dependents** (`source: 'aggregate-chain'` with no classifier registered, or the classifier returning `'soft'`) **do not cancel**. The parent's commandId is removed from each soft dependent's `blockedBy`; when the gating set empties, status flips `'blocked'` → `'pending'` and the dependent gets an independent attempt. The server then arbitrates — if the dependent's precondition was genuinely required by the now-failed parent, the server rejects it loudly.

The classifier is consulted at the moment a cascade decision is needed against current state — its result is not stored; each evaluation re-runs the callback. A classifier throw propagates and halts the cascade walk at the point of the exception, consistent with how `validate` / `validateAsync` / `handler` throws are treated. Cancellation propagates synchronously: by the time the walk visits the next layer, the in-between command's chain has already been detached via the existing terminal-status cleanup, so the classifier sees the restitched chain rather than the dead intermediate command.

### 4.8.3 Pluggable failure mapping

Server responses are translated into `FailureDescriptor` values (`{ category, errorCode?, validationErrors?, details? }`) by a pluggable `FailureMapper`. The library ships category-defaults grounded in RFC 9110 status codes and recommended body conventions; consumers override per-command or globally to encode their own semantic identifiers (problem+json `type` URIs, ld+json `@type`, bespoke `body.name` strings, etc.).

**Resolution rule (presence-based, no automatic cascade).** When a per-command `mapFailure` is defined on `CommandHandlerRegistration`, it is the sole arbiter for that command's response — the library does not fall through to the global. A consumer who wants the global's behaviour for non-special cases imports the same function reference and calls it explicitly.

When per-command is absent, the global `CqrsConfig.mapFailure` runs (which defaults to a problem+json-aware library helper).

**Library-provided defaults.** Composable mappers exported from the library:

- `defaultStatusMapper` — RFC 9110 status → category, no body inspection.
- `defaultProblemJsonMapper` — RFC 9457 problem+json: lifts `type` into `errorCode`, delegates to `defaultStatusMapper` for category. Behaves identically to `defaultStatusMapper` when the body isn't a problem document.
- `defaultLdJsonMapper` — JSON-LD shape: lifts `@type` into `errorCode`, otherwise delegates.

Consumers building against bespoke error formats supply their own `FailureMapper` reading whatever shape their server emits.

**Handler-returned categorized failures.** In addition to server-derived categories, the `handler` function returns a flat algebraic outcome (`DomainExecutionOutcome<TEvent>`) with variants for `'success'`, `'validation-error'`, `'unknown-command'`, and `'conflict'`. The `'conflict'` variant carries a `ConflictException` with a `category: FailureCategory` — this is how a handler reports a _conflict it detected against its `{ initial, current }` state_ ([§4.7.1](#471-handler-state-input--first-call-vs-regenerate)).

Routing depends on **when** the conflict surfaces:

- **Submit-time** — the handler's first call (or `validateAsync` returning `Err(ConflictException)`) at enqueue. The `submit()` Promise rejects with `Err(ConflictException)`, identical in external shape to a validation rejection. The command **does not persist**. From the consumer's view: the operation didn't proceed, same as any other validation rejection. Consumers discriminate via the exception type (`isConflict(err)` vs `isValidationException(err)`) if they care.

- **Pipeline-time** — regenerate during reconcile, id-rewrite cascade after a parent command resolves, or AutoRevision resolution. By definition the command was already persisted (submit returned Ok long ago). The Command Queue routes the conflict via `markFailedFromConflict(commandId, exception)`: the command transitions to `'failed'` with a `CommandFailedException` carrying the `category` and `errorCode` from the `ConflictException`; `command:failed` fires; dependents fan out per the hard-and-soft cascade rule ([§4.8.2](#482-failure-category-taxonomy)) — hard dependents auto-cancel, soft dependents unblock for an independent attempt. (Particularly relevant for `'redundant'` conflicts where the user's intent is already satisfied by another path: chain-only dependents may still be valid against current state.) `enqueueAndWait`-style awaiters resolve `Err(CommandFailedException)` through the existing terminal-status subscription — no special wiring on the awaiter side.

This split aligns with the broader queue contract: `submit()` returns `Ok` when the command persists in the queue, `Err` when it didn't. Conflicts that arrive after the command is already persisted surface via the persisted command record and the event bus, not via the original submit promise.

`validate` keeps `Result<unknown, ValidationException>` (sync, no read-model access — can't usefully detect conflicts). `validateAsync` widens to `Result<unknown, ValidationException | ConflictException>` because it has `queryManager` access and is a natural place to surface conflicts ("another entity already has this name").

---

## 4.9 Reconciliation with server results

The Command Queue reconciles each succeeded command against its server response by walking declarative path metadata on the handler registration ([§4.6.2](#462-post-processing)).

The reconciliation pass:

1. Reads the command response and resolves server-assigned ID(s) at paths declared by `responseIdReferences`, or via the `responseIdMapping` callback when provided.
2. Builds a per-aggregate `idMap` of `{ clientId → { serverId, nextExpectedRevision? } }`.
3. Walks each pending command's `commandIdReferences` paths, replacing matching client IDs with server IDs in the command data.
4. Updates the cache key system ([`0003 §3.2.4`](0003-cache-manager.md#324-entityref-driven-inputs-and-reconciliation)) with the same ID mappings so cache key identities reconcile and `CacheKeyReconciled` events fire.
5. Regenerates anticipated events for affected commands by re-running their handlers with the rewritten data.
6. Discards the original anticipated events; the regenerated events flow through the Event Cache → read model in their place.

Each aggregate's `lastKnownRevision` is updated from the response's revision path so subsequent operations see consistent revision tracking.

When the consumer's response shape doesn't expose IDs at predictable paths, `responseIdMapping` provides the escape hatch — it returns explicit `{ clientId: EntityRef; serverId: string; nextExpectedRevision? }` entries.

---

## 4.10 Interaction with cache eviction

- Cache eviction **never deletes or cancels commands**.

- Commands remain valid regardless of which cache keys are currently resident.

**Exception:** a user identity change triggers a full local data wipe, which includes the Command Queue (see [§4.5.3](#453-user-identity-change-handling)).

---

## 4.11 Optional command-driven cache behavior (configurable)

The Command Queue may be configured with an optional callback:

`onCommandEnqueued(command) -> { touchKeys?: CacheKeySpec[]; freezeKeys?: CacheKeySpec[] } | null`

This allows applications to:

- automatically load data needed to observe command effects

- optionally freeze relevant cache keys while commands are pending

This behavior is optional and not required for correctness.

---

## 4.12 Events

The Command Queue emits the following events.
TypeScript event type names below; runtime keys are kebab-case under the `command:` and `commandqueue:` namespaces and map mechanically except where called out.

- `CommandEnqueued`

- `CommandStatusChanged`

- `CommandCompleted` — emitted on success.

- `CommandFailed`

- `CommandCancelled`

- `CommandSent` — emitted when a command is dispatched to the server (after dependencies are satisfied, before the response arrives).

- `CommandResponse` — emitted when a server response arrives for a sent command.

- `CommandQueuePaused` _(runtime key: `commandqueue:paused` — namespace is `commandqueue:`, not `command:`)_

- `CommandQueueResumed` _(runtime key: `commandqueue:resumed` — namespace is `commandqueue:`, not `command:`)_

These events are informational; consumers needing current command state should query it directly.

The terminal event types `CommandCompleted` / `CommandFailed` / `CommandCancelled` fire **after** post-processing completes (id reconciliation, dependent unblocking, anticipated event cleanup).
A `CommandStatusChanged` event whose `status` is terminal fires at the status flip — **before** post-processing.
Consumers that need to observe fully-settled state (e.g. `waitForSucceeded`) should subscribe to the terminal event types, not the status change.

---

## 4.13 Failure and recovery guarantees

The Command Queue must ensure:

- no command is lost once persisted (within a session)

- retries resume correctly after reloads or crashes

- partial failures do not corrupt command state

- anticipated events are cleaned up deterministically

- session changes result in a complete reset with no cross-user leakage

---

## 4.14 File upload commands

The Command Queue natively supports commands that include file uploads.

### 4.14.1 File storage model

Files attached to commands are stored **separately from the command record**:

- The command record in SQLite stores `fileRefs: FileRef[]` — metadata and storage-path references for each attached file ([§4.14.2](#4142-fileref-schema)).
- The actual file bytes are stored via an `ICommandFileStore` abstraction with three first-party implementations:
  - **OPFS** (Mode B and C, browser) — `OpfsCommandFileStore`. Window context writes via the async OPFS API before the command is enqueued; the worker reads when executing. Files persist across page reloads and browser restarts.
  - **In-memory** (Mode A, browser online-only) — `InMemoryCommandFileStore`. Held as `Blob` references in a runtime map. Not persisted; lost on reload, which is acceptable since Mode A makes no persistence guarantees.
  - **`node:fs`** (Electron) — `FsCommandFileStore` in `@cqrs-toolkit/client-electron`, writing to the OS filesystem inside the utility process. Browser-side renderer windows reach the store through `ElectronCommandFileStore` (IPC bridge to the utility process). Files persist across app restarts.

The abstraction is deliberate: each runtime environment provides the file store implementation appropriate to its persistence and IPC model, and downstream code (Command Queue, command sender) operates against the interface uniformly.

This separation ensures SQLite remains fast (no large blobs in the database), and that files can be cleaned up independently of command records.

### 4.14.2 FileRef schema

```ts
interface FileRef {
  id: string // Unique file identifier (UUID) — used for the storage path and per-file operations
  filename: string // Original filename
  mimeType: string // MIME type
  sizeBytes: number // File size in bytes
  storagePath: string // Path from the storage root (e.g. `cqrs-client/uploads/{commandId}/{fileId}` for OPFS)
  checksum?: string // Optional integrity check (e.g. SHA-256 hex)
  data?: Blob // Hydrated by the library before send(); undefined at rest
}
```

`FileRef` is persisted in SQLite in Mode B/C with `data` undefined; the library hydrates `data` from the active file store before passing the command to the sender.
In Mode A, `FileRef` is held in memory alongside the command and `data` is populated directly with the consumer-provided `File`/`Blob`.

### 4.14.3 OPFS file storage (Mode B and C)

The window context is responsible for writing files to OPFS **before** enqueuing the command.
The async OPFS API (`navigator.storage.getDirectory()`, `getFileHandle()`, `createWritable()`) is available on the main thread and is used for this write.

**Path scheme.** OPFS layout: `/cqrs-client/uploads/{commandId}/{fileId}`. `FileRef.storagePath` stores this relative to the storage root (i.e. `cqrs-client/uploads/{commandId}/{fileId}` — no leading slash).

The worker never writes to the uploads directory.
It reads files from OPFS by path (using `getFileHandle()` from `navigator.storage.getDirectory()`) when executing or retrying the upload command.

**Lifecycle:**

1. Window writes file bytes to OPFS path, obtains the path string.
2. Window enqueues command with `fileRefs` referencing the OPFS path.
3. If command enqueue fails after the file has been written, the file is orphaned — see [§4.14.5](#4145-orphan-cleanup) (orphan cleanup).
4. Worker reads file from OPFS path when executing the upload.
5. **Files are deleted when their owning command is deleted.** Command deletion is the single cleanup trigger, regardless of the reason for deletion (success, failure, cancellation, session reset, or debug mode expiry). There are no separate per-outcome cleanup rules.

### 4.14.4 In-memory file storage (Mode A)

In online-only mode, files are held as `Blob` references directly in the in-memory command record.
No OPFS write occurs.
Files are lost on page reload, which is acceptable — Mode A makes no persistence guarantees and upload commands are expected to complete within the session.

There is no `storagePath` in Mode A file references.
The command payload carries the blob directly.

### 4.14.5 Orphan cleanup

An orphaned file is a file present in the file store with no corresponding command record in SQLite.
Orphans can occur if:

- The window staged a file but the subsequent command enqueue failed.
- A crash occurred between the file write and the SQLite commit.

The `ICommandFileStore` interface exposes orphan-cleanup capability; on library startup, after SQLite is initialized, the Command Queue invokes it with the current set of valid command IDs and the file store deletes any files whose owning command no longer exists.

### 4.14.6 Upload execution

The Command Queue does not own upload execution and is deliberately free of upload conventions.
Its responsibility ends at hydrating `FileRef.data` with a Blob (read via the active `ICommandFileStore` implementation — see [§4.14.1](#4141-file-storage-model)) and passing the command — including its hydrated `fileRefs` — to the consumer-injected command sender, which decides how to transmit the file content.

This separation keeps `@cqrs-toolkit/client` agnostic to upload conventions (direct multipart, S3 presigned, custom transports, etc.).
Convention-bearing implementations live one layer up:

- `@cqrs-toolkit/hypermedia-client` auto-wires upload behavior when the server's Hydra documentation declares a workflow the toolkit recognizes — consumers using the hypermedia command sender need no upload boilerplate. The first-party `svc:PresignedPostUpload` convention (S3 presigned form upload) is wired in by default; future conventions slot in alongside it.
- Consumers not using hypermedia-client (or whose server doesn't follow the conventions) implement upload directly in their command sender, working from the hydrated `fileRefs` on each command.

In all cases, the active upload behavior is whatever the consumer's command sender does with the hydrated `fileRefs` — the Command Queue does not enumerate or select among approaches.

### 4.14.7 File store write failure

If a file store write fails when staging a file (quota exceeded, permission error, disk full, or any other reason):

- The command enqueue is rejected with an appropriate error.
- No partial state is written — if the file write fails, the command is never submitted to the worker.
- The library emits a storage error event the host application can handle (e.g. to inform the user).

There is no per-file fallback between file store backends.
The active backend is determined at startup by the runtime environment (see [§4.14.1](#4141-file-storage-model)); silent per-file fallback would produce inconsistent state across the command queue and is not supported.

---

### 4.14.8 File persistence guarantees

The library supports two levels of file persistence guarantee.
The weak guarantee is the current implementation target.
The strong guarantee is deferred pending server protocol definition.

---

#### Weak guarantee (current implementation)

**File lifetime matches command lifetime exactly.**

A file exists in OPFS for as long as its owning command exists in SQLite.
The file is deleted when the command is deleted, for any reason.
The library makes no attempt to associate the local file with the resulting server asset or read model record.

This guarantee is unconditional — it requires no server contract and no event correlation.
In debug mode, where commands are retained after success rather than immediately deleted, files are retained for the same duration automatically.

The UI may display the local OPFS file as a preview while the command is pending (the file is guaranteed to exist for the lifetime of the command). Once the command is deleted and the server URL is available in the read model, the UI transitions to the server URL. There is no library-managed handoff between the two — the transition is a natural consequence of command deletion and read model hydration.

---

#### Strong guarantee (deferred — requires server protocol)

**Local file is served from OPFS as the canonical source for the read model record, for as long as it exists locally, without requiring a re-download.**

This eliminates the need for the user to re-download a file they just uploaded, even after the command has been processed and the read model has been hydrated with the server asset. This is particularly valuable for users on slow or intermittent connections who should never pay the cost of downloading content they just uploaded.

This association is non-trivial under the S3 presigned upload model, where the upload path is:

```
Client upload → S3 → S3 event → Server processing → Server event → Client event → Read model
```

The `commandId` must be propagated through this entire chain to allow the library to close the loop.
This is achievable because the monorepo server utilities own the server contract — `commandId` propagation through confirmation events is a library protocol requirement that server utilities will fulfill automatically. Consumers do not need to implement this manually.

**Required server protocol (to be defined):**

- The presign request must carry the `commandId`.
- The server must persist the `commandId` alongside the asset record.
- The confirmation event delivered to the client must include the original `commandId`.
- The library matches the incoming event to the pending command by `commandId` and establishes the association between the OPFS file and the resulting asset ID in the read model.

**Read model integration under strong guarantee:**

Once the association is established, the library annotates the read model record for the asset with a local file reference.
When the read model is queried, the library resolves asset URLs with the following priority:

1. Local OPFS file (if the originating command still exists and the file is present)
2. Server URL (CDN or direct)

This resolution is transparent to the UI — the query interface returns a resolved URL regardless of source.
The local file serves as an instant-load cache that degrades gracefully to the server URL as the command is eventually cleaned up.

**Implementation note:**

The strong guarantee will be designed and implemented once the server protocol for `commandId` propagation is finalized.
The weak guarantee implementation must not preclude upgrading to the strong guarantee.
Specifically, the `FileRef` schema, OPFS path scheme, and command lifecycle hooks should be designed with the upgrade path in mind — the strong guarantee adds association and read model annotation on top of the existing file lifecycle, it does not replace it.
