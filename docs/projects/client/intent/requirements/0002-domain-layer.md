# 2\. Domain Layer (Client-side)

## 2.1 Purpose

The Domain Layer provides **pure business logic** for client-side command validation and execution.
Its sole responsibility is to **produce anticipated domain events** that represent the intended outcome of a command, prior to server confirmation.

The Domain Layer:

- does **not** manage persistence

- does **not** perform network I/O

- does **not** manage cache keys, sessions, or synchronization

- does **not** expose UI state

All UI-visible state is derived exclusively from the Read Model Store.

---

## 2.2 Responsibilities

The Domain Layer is responsible for:

### 2.2.1 Command validation and execution

- Validate commands against domain invariants that can be checked locally.

- Execute commands deterministically to:
  - produce **anticipated domain events**

  - fail fast on invalid commands where possible

### 2.2.2 Anticipated event production

- Produce anticipated events that:
  - match server event **type names and overall payload shape**, with one exception: ID fields referencing locally-created entities may carry `EntityRef` values per [0014 §14.5.1](0014-entity-ref.md#1451-entityref-in-anticipated-events), where server-originated events always carry plain strings

  - can be processed by the same event processors as server events

- Anticipated events:
  - do **not** include server-assigned fields such as `position` or authoritative `createdAt`

  - are marked with `persistence = 'Anticipated'` when stored

  - are associated with a `commandId`

### 2.2.3 Metadata attachment

- Attach required metadata to commands and anticipated events, including:
  - `commandId` (client-generated, stable)

  - correlation and causation identifiers

- Metadata must be sufficient for:
  - optimistic application

  - later reconciliation

  - post-processing (e.g., entity ID reconciliation when the server confirms locally-created entities — see [0014](0014-entity-ref.md))

### 2.2.4 Entity identifiers

- When a command creates an entity, generate the entity's own ID via the context-provided helper (`createEntityId(context)`), which returns a plain string.

- The library marks each generated ID as **temporary** (server will issue a permanent ID on confirmation) or **permanent** (the client value is final), per the `idStrategy` declared on the command. See [0014 §14.4](0014-entity-ref.md#144-id-strategy).

- Entity reference IDs in command data are opaque to the Domain Layer — they may be plain strings or `EntityRef` values, and must be passed through to anticipated events unchanged. See [0014 §14.5.2](0014-entity-ref.md#1452-command-submission-entityref-extraction-point).

---

## 2.3 Explicit non-responsibilities

The Domain Layer **must not**:

- Perform network requests

- Read from or write to persistent storage

- Access the Read Model Store

- Depend on Query Manager state

- Depend on cache keys, scopes, or eviction policy

- Depend on session or authentication state

- Perform reconciliation with server responses

All such concerns are owned by downstream components.

---

## 2.4 Public contract (conceptual)

The Domain Layer exposes a pure execution interface:

```ts
execute(command, currentState?) -> {
  anticipatedEvents: Event[];
  postProcessPlan?: PostProcessPlan;
}
```

Where:

- `command` is the submitted command record (type, data, path, fileRefs).

- `currentState` is the consumer-provided read-model snapshot the user was operating against when the command was submitted. The consumer is expected to pass this whenever the command is being submitted against an existing entity (mutate, transition, soft-delete) — it lets state-dependent handlers reflect what the user actually saw. It is omitted when the command targets nothing yet (e.g. a create against an unseeded collection). The Domain Layer treats it as input data: if absent, the handler must still produce well-defined output for that case.

- `anticipatedEvents` is an ordered list of domain events representing the optimistic outcome.

- `postProcessPlan` (optional) describes how commands and anticipated events should be transformed once server results are known.

`currentState` becomes the durable `initial` snapshot on the persisted command record (see [`0004 §4.4.2`](0004-command-queue.md#442-submit-time-inputs)). At the implementation level the Domain Layer sees a discriminated union `state: HandlerState`:

- `{ mode: 'initial'; initial }` — first invocation, at enqueue time. Only `initial` is meaningful.
- `{ mode: 'regenerate'; initial; current }` — any subsequent invocation, regardless of trigger (server-event delta during reconciliation, id-rewrite cascade after a parent command resolves, AutoRevision resolution). The library always populates `current` with the latest read-model view of the command's primary entity, so handler behavior is consistent across triggers.

`initial` is constant for the command's lifetime. `current` may be `undefined` only when the entity isn't yet in the read-model store (no overlay folded yet, outside active cache); it is never `undefined` as a "trigger-based" signal. With both views in hand, a handler that wants to detect "the field I was editing has been changed by someone else since I queued my edit" has the data it needs.

This shape applies to the command-level functions (validate, validateAsync, handler). Event Processors ([`0008`](0008-event-processors.md)) are an entity-level reducer fed an event and the current entity state by the fold; the "what the user saw at submit" concept does not apply to them, and their state argument stays unchanged.

**Outcome shape — flat algebraic union.** The handler's output is not a binary success/failure: it discriminates on a `kind` field over four variants:

- `'success'` — produced anticipated events (and optional `postProcessPlan`).
- `'validation-error'` — structural validation failed; the command is rejected at submit and not persisted.
- `'unknown-command'` — the executor has no registration for this command type; rejected at submit.
- `'conflict'` — the handler detected a state conflict (using `{ initial, current }`) and is signaling a categorized failure (`category: FailureCategory`). Routing depends on **when** the conflict surfaces (see [`0004 §4.8.3`](0004-command-queue.md#483-pluggable-failure-mapping)): at submit time (handler's first call) the conflict rejects the submit identical to a validation rejection; at pipeline time (regenerate during reconcile / id-rewrite / revision-resolution) the persisted command transitions to `'failed'` with the category accessible to the UI.

`validate` keeps `Result<unknown, ValidationException>` — it has no read-model access and validation is binary. `validateAsync` widens to `Result<unknown, ValidationException | ConflictException>` because it has `queryManager` access and is a natural place to detect conflicts ("another entity already has this name"). Submit-time conflicts and validation errors flow through the same `Err` path on `submit()`; consumers discriminate via the exception type if they care.

The Domain Layer **must be deterministic**: given the same `(command, state)` input, it must always produce the same outcome. Determinism explicitly includes the state argument — a handler that produces different outcomes for `{ mode: 'initial', initial: A }` vs `{ mode: 'regenerate', initial: A, current: B }` is correct precisely because the inputs differ.

---

## 2.5 Relationship to the Command Queue

- The Domain Layer does **not** enqueue commands.

- The Command Queue:
  - invokes the Domain Layer

  - persists the command

  - persists anticipated events in the Event Cache

- The Domain Layer does not know whether a command will be:
  - sent immediately

  - delayed

  - retried

  - cancelled

---

## 2.6 Relationship to cache keys and scopes

- The Domain Layer does **not** know which cache keys or scopes are currently active.

- Anticipated events may affect:
  - data currently present in local caches

  - data that is not currently cached

- Event processors and the Read Model Store determine whether and where anticipated events apply.

This ensures that:

- commands never depend on local read model availability

- eviction of cached data never invalidates pending commands

---

## 2.7 Relationship to sessions and users

- The Domain Layer is **session-agnostic**.

- It must not embed or rely on:
  - user identity

  - authentication state

  - tenant visibility

- Any user- or session-related metadata required by the server must be:
  - supplied externally (e.g., by the Command Queue or transport layer)

  - not derived from Domain Layer state

---

## 2.8 Anticipated vs server events

- Anticipated events are treated as provisional.

- When authoritative server events arrive:
  - anticipated events are discarded or rebased

  - effective state is recomputed downstream

- The Domain Layer does not participate in this reconciliation.

---

## 2.9 Open ambiguity (to resolve later)

- **Correlation / causation metadata standardization**  
  A shared, cross-service convention for correlation and causation fields is required but not yet finalized.

---
