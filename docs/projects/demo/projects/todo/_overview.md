# Todo demo

**Status:** Active
**Castle:** this directory
**Public API:** N/A
**Composing demo packages:** `demos/base`, `demos/todo-demo`
**Depends on (within repo):** `client`, `client-solid`, `realtime`, `devtools`
**Depended on by (within repo):** none — terminal consumer

*Note on `devtools`.* Listed despite no direct source import.
This sub-project's e2e suite at `demos/todo-demo/tests/extension/` *defines* the devtools extension's end-to-end tests, making the extension an effective dep of this sub-project.
This is a deliberate exception to the [direct-source-import counting rule](../../../_overview.md) — flagged so the rule's strictness elsewhere isn't softened by this one entry.

## Purpose

A full-stack SolidJS + Fastify todo app demonstrating `@cqrs-toolkit/client`.
The simplest reference implementation, exercising the core CQRS / event-sourcing client surface end-to-end with optimistic updates, offline support, and multi-tab coordination.

## Current state

Single-page web app served from Vite (port 5173) talking to a Fastify API (port 3001).
Default execution mode is **shared-worker** (`detectMode()` returns `shared-worker` in any modern browser with SharedWorker support).
`?mode=<mode>` query param forces a specific mode (`shared-worker`, `dedicated-worker`, or `online-only`); the app fails to start if the requested mode is not available.
`auto` is the default and is also accepted explicitly for clarity.

## Where things live

- Feature e2e tests: `demos/todo-demo/src/**/tests/*.e2e.ts`
- Extension e2e tests: `demos/todo-demo/tests/extension/`
- Run: `npm run dev -w @cqrs-toolkit/todo-demo` (starts both server and Vite)
