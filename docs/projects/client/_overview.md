# @cqrs-toolkit/client

**Status:** Active
**Castle:** this directory
**Public API:** experimental
**Depends on (within repo):** `realtime`
**Depended on by (within repo):** `client-solid`, `client-electron`, `hypermedia-client`, `devtools`; demos: `base`, `hypermedia-base`, `hypermedia-electron`, `hypermedia-web`, `todo-demo` (`hypermedia-server` is server-side only)

## Purpose

Offline-capable CQRS / event-sourcing client library for the browser.
Manages command queuing, event caching, read model projection, and sync — with pluggable execution modes that range from a simple online-only proxy to full offline support via SharedWorker + SQLite (OPFS).

## Current state

Core components implemented (CommandQueue, EventCache, ReadModelStore, SyncManager, CacheManager, QueryManager) plus three execution adapters (online-only, dedicated-worker, shared-worker).

## Always Read entries

- [ADR 0001 (decisions) — Anticipated events: submit-time and pipeline-time are separate concerns](decisions/0001-anticipated-event-submit-vs-pipeline.md) — every async-handling change in client risks tripping over this; the design has been re-attempted and reverted before, costing significant time.
- [`mindset/severity-from-invariants.md`](mindset/severity-from-invariants.md) — when triaging async multi-storage bugs, reason from violated invariants, not UI symptoms or whose feature broke. The right framing for severity calls in this architecture.

## Wings

- [`intent/requirements/`](intent/requirements/_overview.md) — the spec, NNNN-slug per requirement.
- [`decisions/`](decisions/_overview.md) — ADRs scoped to this project.
- [`evolution/`](evolution/_overview.md) — project changelog.
- [`mindset/`](mindset/_overview.md) — analytical framings.

## Where things live

- Integration tests: `packages/client/src/__integration__/*.integration.test.ts`
- End-to-end tests (Playwright): `demos/todo-demo/`, `demos/hypermedia-web/`, `demos/hypermedia-electron/`
- Generated API docs: `packages/client/docs/api/`
