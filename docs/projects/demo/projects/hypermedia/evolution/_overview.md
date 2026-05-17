# hypermedia demo — changelog

Append-only history of significant changes to the hypermedia demo sub-project.
Wing-level structural events and cross-cutting changes; per-requirement substantive changes belong in each requirement's paired `-log.md` once requirements exist here.

## 2026-05-14 — Notebook rename: server-side idempotency + client pre-emptive redundancy detection

Proves the failure-mapping pipeline (`FailureCategory` + per-command `validateAsync` returning `ConflictException`) on a realistic concurrent-edit scenario: two clients renaming the same notebook.

Two flavours are now distinguished:

- **Same target** (both clients pick the same new name) — server-side idempotency.
  [`NotebookAggregate.updateName`](../../../../../../demos/base/src/notebooks/server/aggregate.ts) early-returns when `data.name === this._name`, matching the existing idempotency pattern on `addTag` / `removeTag`.
  No event is emitted, the command persists no changes, the server returns 200 with `events: []`.
  No new exception class — the user's intent is already satisfied; nothing to surface as an error.
- **Different target** (clients pick different names against a stale revision) — ddd-es default `eventsConflict` catches it.
  Two `NotebookNameUpdated` events on the same aggregate collide via the default same-type rule; the route propagates `EventConflictException` through `handleErrorReply`, producing a 409 `urn:problem:nb.EventConflict:1.0.0` problem.
  The client's default `defaultProblemJsonMapper` categorizes this as `'requires-review'`.

Client-side pre-emptive detection in [`notebookHandlers` for `nb.UpdateNotebookName`](../../../../../../demos/hypermedia-base/src/domain/notebooks/executor.ts):

- `validateAsync` inspects the read model: if any notebook already carries the requested name and its `id` matches the target, return `Err(new ConflictException({ category: 'redundant', errorCode: 'nb.RedundantNameUpdate' }))`.
  Catches both the local no-op rename (user typed the current name) and the race where the remote rename's WS event arrived before this command was submitted.
- The cross-aggregate uniqueness check (existing) and the redundancy check now share one `list()` pass — a duplicate-by-name lookup that branches on `match.id === id`.
- The server idempotency means missing this check is recoverable (one wasted round-trip, no error UI); catching it saves the round-trip and surfaces the typed `'redundant'` category for UI dispatch.

No per-command `mapFailure` is needed.
The 409 `EventConflict` already maps to `'requires-review'` via the default; redundancy is detected pre-emptively by the client (or transparently absorbed by server idempotency); there's no third category to translate.

Tests:

- [`demos/hypermedia-server/src/notebooks/routes.test.ts`](../../../../../../demos/hypermedia-server/src/notebooks/routes.test.ts) — three new cases under `describe('updateName')`: idempotent same-name no-op, concurrent different-target → 409 `nb.EventConflict`, concurrent same-target → 200 with `events: []`.
- [`demos/hypermedia-base/src/domain/notebooks/executor.test.ts`](../../../../../../demos/hypermedia-base/src/domain/notebooks/executor.test.ts) — three pure-function unit tests for `validateAsync`: same name returns redundant `ConflictException`, cross-clash returns `ValidationException`, free target returns `Ok`.
  Added a minimal `vite.config.ts` under `demos/hypermedia-base/` and listed it in the root `vitest.config.ts` projects so the workspace has a unit-test home; previously the package had no test runner.

A "true" multi-tab e2e variant was considered and deferred — Playwright timing on shared-state races between two browser contexts is hard to make reliable, and the unit + integration coverage above pins the load-bearing semantics.

## 2026-05-10 — Unified RFC 9457 problem+json error envelope (hypermedia-server)

Migrated every error response in `demos/hypermedia-server/` from the ad-hoc `{ message, details? }` shape (served as `application/json`) to [RFC 9457 — Problem Details for HTTP APIs](https://www.rfc-editor.org/rfc/rfc9457), served as `application/problem+json`.
The originating decision was made upstream in the production event-sourcing codebase (its `ADR-0006 — Adopt RFC 9457 application/problem+json for Error Responses`, accepted 2026-04-30); the rationale recorded there — Hydra schema referenceability, a stable `type` URN as the client dispatch key, and an information-disclosure boundary at the wire — applies here unchanged, so the body of that ADR is not restated inline.
The hypermedia demo is downstream of that decision; this entry records its application here, not a new decision.

Why this demo adopts the production envelope:

- The hypermedia demo is the [load-bearing reference implementation](../../../_overview.md) for the toolkit; emitting a different error shape than the production server it's modelled on would teach consumers the wrong wire format.
- The previous three concurrent error shapes (a Fastify-default `{ statusCode, error, message }` on pass-through, the route-level `{ message, details }` envelope, and the 500-handler's `{ message: 'Something went wrong' }`) produced no stable dispatch key for clients.
- The toolkit's Hydra/OpenAPI documentation can now declare a single `Problem` schema reference and have every error route point to it, instead of bespoke per-route shapes.

Approach:

- The problem+json infrastructure is kept local to the demo at `demos/hypermedia-server/src/problems/` (a self-contained `types.ts` + `hooks.ts` + `index.ts`) — no imports from other demo packages.
  This preserves type isolation so the module can be lifted into a shared package once the surface stabilizes and the demo proves it covers what the production server uses.
- The local `ExceptionRegistry` mirrors the production version: exception classes either auto-emit the base `Problem` shape with `FieldError[]` details (when present), or register a custom schema/extractor for typed extension fields.
  No registrations were needed for the existing demo exceptions (`DuplicateNotebookNameException`, `NotFoundException`, `BadRequestException`, `ForbiddenException`, etc.) — the default extractor handles them via the `details` array.
- A new `setupCorrelationIdHook` Fastify plugin adopts incoming `x-correlation-id` (or generates one via `crypto.randomUUID()`), exposes it as `request.correlationId`, echoes it on the response, and writes it back into the request headers so downstream readers see one consistent value.
- `setupErrorHandler` registers a single global Fastify error handler that routes every uncaught error through `handleErrorReply`, eliminating the three previously concurrent error envelope shapes.

Changes:

- Added `demos/hypermedia-server/src/problems/` with `BaseProblem`, `BaseProblemSchema`, `ProblemSchema` (URN `urn:schema:nb.Problem:1.0.0`), `FieldErrorSchema` (URN `urn:schema:nb.FieldError:1.0.0`), `ExceptionRegistry`, `exceptionRegistry`, `handleErrorReply`, `PROBLEM_CONTENT_TYPE`, `setupCorrelationIdHook`, and `setupErrorHandler`.
- Replaced the route-level `reply.code(N); return { message, ... }` pattern across `todos/`, `notes/`, `notebooks/`, and `file-objects/` routes (including the upload route) with `return handleErrorReply(request, reply, exception)`.
  Exception choice is now explicit: `NotFoundException` for 404, `BadRequestException` for 400 user errors, `ForbiddenException` for 403 signature failures.
  The previously local `handleErr` helper in `command-utils.ts` was removed since every call site became a direct `handleErrorReply` call.
- `query-utils.handleProfileHandler` now routes ProfileHandler errors through `handleErrorReply` instead of emitting `application/json` `{ message, details }`.
- Replaced the bespoke `nb.Error` schema (`src/error-schema.ts`) with the unified `ProblemSchema`.
  Updated the `FileObject` download operation's 404 response and the OpenAPI `globalResponses` 500 entry to reference `ProblemSchema` at content type `application/problem+json`.
  Removed the now-orphaned `static/meta/schemas/urn/schema/nb.Error/1.0.0.json` build artifact.
- The duplicate-request response cache in `bootstrap.ts` now preserves the original response's `content-type` header so cached problem+json replies remain `application/problem+json` on replay (not the Fastify default `application/json`).
- Adjusted the `CommandResponse`-typed cache shape to `unknown` — the cache now spans both `CommandSuccessResponse` bodies and problem+json bodies, and the type was no longer accurate.

Tests:

- `routes.test.ts` for todos and notes now asserts the problem+json envelope (`type`, `status`, `detail`) and the `application/problem+json` content type on 404 responses, instead of the prior `{ message: '... not found' }` shape.
- `meta/routes.test.ts` updated to assert that the download 404 schema reference points at `nb.Problem` at content type `application/problem+json` (was `nb.Error` at `application/json`).
- Full unit suite (1779 tests) passes.

Out of scope:

- The `todo-demo` server (`demos/todo-demo/server/`) was deliberately not migrated — it continues to emit the ad-hoc shape and still uses `CommandResponse` from `@cqrs-toolkit/demo-base/common/shared`.
  The `CommandErrorResponse` and `CommandResponse` types remain in `demos/base/` for that consumer.
- The mock-S3 `GET /s3/files/:id` 404 response remains S3-style XML — it's modelling an opaque external service, not a domain API surface.
- The WebSocket upgrade rejection `503` still sends an empty body — WebSocket handshake replies have no JSON envelope.

Migration to a shared package:

The infrastructure is currently demo-local on purpose.
A library move only makes sense once the surface fully covers what the production server has needed (custom-extractor registrations, per-service exception tagging à la ADR-0007 in event-sourcing, response-set helpers like `STANDARD_COMMAND_ENVELOPE_PROBLEM_RESPONSES`); until then it would be a partial cover that consumers would have to supplement.
If/when promoted, the natural home would be a new toolkit package rather than expanding `@cqrs-toolkit/hypermedia`'s public surface.
