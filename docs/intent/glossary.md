# Glossary

Vocabulary that spans packages.
Project-specific terms (e.g., client-internal types like `EntityRef`, `CacheKey`) live in that project's requirements wing, not here.

## CQRS / Event sourcing

- **Command** — a request to change state.
  Names are imperative (`CreateTodo`, `RenameTask`).
  Commands fail if the domain rejects them; they do not return data, they return success/failure plus a sequence of events.
- **Event** — an immutable fact about something that happened.
  Names are past tense (`TodoCreated`, `TaskRenamed`).
  Events are the source of truth; current state is derived by replaying events.
- **Aggregate** — a consistency boundary around one or more entities.
  Commands target an aggregate; events are emitted from it; an aggregate's identity is its stream ID.
- **Stream** — the ordered sequence of events for a single aggregate, identified by stream ID (e.g., `Todo-abc123`).
- **Anticipated event** — a client-side prediction of what an event will look like once the server confirms the command, used to drive optimistic UI before the server responds.
- **Projection** / **read model** — a denormalised view of state computed by reducing events.
  Projections feed the query side of CQRS.
- **Snapshot** — a point-in-time captured state of an aggregate, used to avoid re-replaying its full event history.

## `@meticoeus/ddd-es` core types

These types are the project's foundational error and result handling.
Every package that participates in the domain layer takes `@meticoeus/ddd-es` as a peer dependency.

```typescript
export interface IException<Details = unknown> extends Error {
  readonly name: string
  readonly message: string
  readonly stack?: string
  readonly code?: number | undefined
  readonly userMessage?: string | undefined
  readonly details?: Details
}

export class Exception<Details = unknown> implements IException<Details> {
  protected _userMessage: string | undefined
  protected _details: Details | undefined

  constructor(
    public readonly name: string,
    public readonly message: string,
    public readonly code?: number | undefined,
  ) {
    Error.captureStackTrace(this, Exception)
  }

  get userMessage(): string {
    return this._userMessage ?? this.message
  }

  get details(): Details | undefined {
    return this._details
  }
}

export interface OkResult<T> {
  ok: true
  value: T
}

export interface ErrResult<E extends IException = IException> {
  ok: false
  error: E
}

export type Result<T, E extends IException = IException> = OkResult<T> | ErrResult<E>

export function Ok<T extends void, E extends IException = IException>(): Result<void, E>
export function Ok<T, E extends IException = IException>(value: T): Result<T, E>
export function Ok<T, E extends IException = IException>(value?: T): Result<T | undefined, E>
export function Ok<T, E extends IException = IException>(value?: T): Result<T | undefined, E> {
  return { ok: true, value }
}

export function Err<T, E extends IException = IException>(error: E): Result<T, E> {
  return { ok: false, error }
}
```

Key points:

- `E` is constrained to `extend IException`.
  The library is being tightened to enforce this; the convention applies today as if the tightening has landed.
  Code written now must not rely on the looseness of any current `E = IException` default.
- `Exception` constructor takes `(name, message, code?)` — details are set via `this._details = ...` inside subclasses.
- `Ok()` can be called with no args for `Result<void, E>`.
- `Err(error)` wraps any `E extends IException`.

For the rules on when to use `Result` vs `assert` vs throw, see [`/docs/patterns/error-handling.md`](../patterns/error-handling.md) and ADR [`/docs/decisions/0002-error-handling-three-categories.md`](../decisions/0002-error-handling-three-categories.md).

## Other repo-wide vocabulary

- **OPFS** — Origin Private File System.
  The browser-local filesystem the client uses for SQLite WASM persistence in worker modes.
- **HAL** — Hypertext Application Language; the JSON hypermedia format `@cqrs-toolkit/hypermedia` renders.
- **Hydra** — the W3C Hydra Core Vocabulary used to describe API surfaces server-side.
- **Worker mode** — the client's execution mode: `online-only`, `dedicated-worker`, or `shared-worker`.
  See [`/docs/projects/client/intent/requirements/0001-modes-and-constraints.md`](../projects/client/intent/requirements/0001-modes-and-constraints.md).
