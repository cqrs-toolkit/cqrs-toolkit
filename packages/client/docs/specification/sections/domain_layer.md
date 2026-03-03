# 1\. Domain Layer (Client-side)

## 1.1 Purpose

The Domain Layer provides **pure business logic** for client-side command validation and execution.
Its sole responsibility is to **produce anticipated domain events** that represent the intended outcome of a command, prior to server confirmation.

The Domain Layer:

- does **not** manage persistence

- does **not** perform network I/O

- does **not** manage cache keys, sessions, or synchronization

- does **not** expose UI state

All UI-visible state is derived exclusively from the Read Model Store.

---

## 1.2 Responsibilities

The Domain Layer is responsible for:

### 1.2.1 Command validation and execution

- Validate commands against domain invariants that can be checked locally.

- Execute commands deterministically to:
  - produce **anticipated domain events**

  - fail fast on invalid commands where possible

### 1.2.2 Anticipated event production

- Produce anticipated events that:
  - match server event **type names and payload shape**

  - can be processed by the same event processors as server events

- Anticipated events:
  - do **not** include server-assigned fields such as `position` or authoritative `createdAt`

  - are marked with `persistence = 'Anticipated'` when stored

  - are associated with a `commandId`

### 1.2.3 Metadata attachment

- Attach required metadata to commands and anticipated events, including:
  - `commandId` (client-generated, stable)

  - correlation and causation identifiers

- Metadata must be sufficient for:
  - optimistic application

  - later reconciliation

  - post-processing (e.g., temp ID replacement)

### 1.2.4 Temporary identifiers

- Support creation of **temporary IDs** for entities not yet persisted on the server.

- Provide enough information for post-processing steps to replace temporary IDs with server-assigned IDs once commands succeed.

---

## 1.3 Explicit non-responsibilities

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

## 1.4 Public contract (conceptual)

The Domain Layer exposes a pure execution interface:

```ts
execute(command) -> {
  anticipatedEvents: Event[];
  postProcessPlan?: PostProcessPlan;
}
```

Where:

- `anticipatedEvents` is an ordered list of domain events representing the optimistic outcome

- `postProcessPlan` (optional) describes how commands and anticipated events should be transformed once server results are known

The Domain Layer **must be deterministic**: given the same command input, it must always produce the same output.

---

## 1.5 Relationship to the Command Queue

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

## 1.6 Relationship to cache keys and scopes

- The Domain Layer does **not** know which cache keys or scopes are currently active.

- Anticipated events may affect:
  - data currently present in local caches

  - data that is not currently cached

- Event processors and the Read Model Store determine whether and where anticipated events apply.

This ensures that:

- commands never depend on local read model availability

- eviction of cached data never invalidates pending commands

---

## 1.7 Relationship to sessions and users

- The Domain Layer is **session-agnostic**.

- It must not embed or rely on:
  - user identity

  - authentication state

  - tenant visibility

- Any user- or session-related metadata required by the server must be:
  - supplied externally (e.g., by the Command Queue or transport layer)

  - not derived from Domain Layer state

---

## 1.8 Anticipated vs server events

- Anticipated events are treated as provisional.

- When authoritative server events arrive:
  - anticipated events are discarded or rebased

  - effective state is recomputed downstream

- The Domain Layer does not participate in this reconciliation.

---

## 1.9 Open ambiguity (to resolve later)

- **Correlation / causation metadata standardization**  
  A shared, cross-service convention for correlation and causation fields is required but not yet finalized.

---
