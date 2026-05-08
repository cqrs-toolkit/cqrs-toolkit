# Vision

cqrs-toolkit is a TypeScript monorepo of npm packages that together provide CQRS / event-sourcing client and server utilities.

The flagship is `@cqrs-toolkit/client` — an offline-first, event-sourced browser client with worker-mode adapters (online-only, dedicated-worker, shared-worker over OPFS + SQLite WASM).
Around the client, supporting packages cover the rest of a real CQRS application:

- **Hypermedia** (`hypermedia`, `hypermedia-client`, `hypermedia-cli`) — server-side and client-side Hydra/HAL/Hydra rendering, content negotiation, embed planning, and CLI tooling.
- **Schema** (`schema`) — JSON Schema validation and runtime hydration with AJV under the hood and `@meticoeus/ddd-es` `Result<T, E>` returns.
- **Realtime** (`realtime`) — canonical WebSocket protocol types and serialisation helpers.
- **Adapters** (`client-electron`, `client-solid`) — Electron utility-process integration and SolidJS reactive primitives wrapping the core client.
- **Devtools** (`devtools`) — Chrome DevTools extension for debugging applications built on the client.

Demos at `/demos/` are reference implementations and e2e test suites — not throwaway samples.
The demo system serves four equally-load-bearing goals (see [`/docs/projects/demo/_overview.md`](../projects/demo/_overview.md)) and gets the same quality bar as the libraries themselves.

## Why this exists

The CQRS / event-sourcing pattern is well-understood at the conceptual level but underserved at the library level — especially on the client.
Existing offerings either commit to a server-only architecture, pretend offline-first is a thin wrapper over local storage, or fail to address the cross-cutting concerns (sync, gap repair, optimistic UI, multi-tab coordination, schema-aware events) that any non-trivial CQRS app needs.

This toolkit is the answer to "what would I want to use if I were building a serious CQRS app today?"
The constraints are taken seriously: offline must actually work, multi-tab is a first-class mode, optimistic updates must be deterministic, the server is the source of truth.

## Status

**Pre-release.**
The public API surface is unstable and subject to breaking changes without notice.
The client-side SQLite schema is not yet finalized; the initial migration may change before stable release, at which point normal migration behaviour will apply.
Until then, upgrading the library may require clearing OPFS data in the browser to avoid schema mismatches.

The pre-release posture is deliberate (see ADR [`/docs/decisions/0001-pre-release-no-back-compat.md`](../decisions/0001-pre-release-no-back-compat.md)) — no back-compat shims while pre-release; that ADR is superseded when the project ships `1.0.0`.

## Tech stack

- **Runtime:** Node.js 20.
- **Language:** TypeScript (ES2022, NodeNext module resolution).
- **Testing:** Vitest (unit, beside source files), Playwright (e2e in demos).
- **Validation:** Zod (selectively), AJV via `@cqrs-toolkit/schema`.
- **Formatting:** Prettier (no semi, single quotes, trailing commas, 100 print width).
- **Core dependency:** `@meticoeus/ddd-es` for shared DDD / event-sourcing primitives — `Result<T, E>`, `Ok`, `Err`, `Exception`.

## Non-goals

See [`non-goals.md`](non-goals.md) for the full list.
At the highest level: this is not a generic state-management library, not a hosted service, not a framework — it is a set of composable libraries that a CQRS application uses directly.
