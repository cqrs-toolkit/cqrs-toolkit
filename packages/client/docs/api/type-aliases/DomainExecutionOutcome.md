[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / DomainExecutionOutcome

# Type Alias: DomainExecutionOutcome\<TEvent\>

> **DomainExecutionOutcome**\<`TEvent`\> = \{ `events`: `TEvent`[]; `kind`: `"success"`; `postProcessPlan?`: [`PostProcessPlan`](../interfaces/PostProcessPlan.md); \} \| \{ `exception`: [`ValidationException`](../classes/ValidationException.md); `kind`: `"validation-error"`; \} \| \{ `exception`: [`UnknownCommandException`](../classes/UnknownCommandException.md); `kind`: `"unknown-command"`; \} \| \{ `exception`: [`ConflictException`](../classes/ConflictException.md); `kind`: `"conflict"`; \}

Outcome of a domain handler invocation — a flat discriminated union over
the four cases the handler can produce. This replaces the prior
`Result<DomainExecutionSuccess, DomainExecutionError>` shape so each
outcome reads as a peer rather than nested error variants.

- `'success'` — produced anticipated events (and optional post-process plan).
- `'validation-error'` — pre-handler structural / sync / async validation
  failed; the command is rejected at submit and not persisted.
- `'unknown-command'` — no registration for this command type. Rejected at
  submit. Bug-shaped on regenerate paths.
- `'conflict'` — the handler detected a state conflict (using
  `{ initial, current }`) and is signaling a categorized failure. The
  command persists with the carried `category` accessible to the queue
  and UI.

`validate` keeps `Result<unknown, ValidationException>` — sync, no read-model access.
`validateAsync` widens to `Result<unknown, ValidationException | ConflictException>`
because it has `queryManager` access and is a natural place to detect conflicts
("another entity already has this name"). Submit-time conflicts and validation errors
flow through the same submit `Err` path; the consumer discriminates via the exception
type if they care.

## Type Parameters

### TEvent

`TEvent`
