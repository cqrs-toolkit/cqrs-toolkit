# @cqrs-toolkit/client-electron

**Status:** Active
**Castle:** this directory
**Public API:** experimental
**Depends on (within repo):** `client`
**Depended on by (within repo):** `hypermedia-electron` demo

## Purpose

Electron adapter for `@cqrs-toolkit/client`.
Runs the full CQRS component stack in an Electron utility process using `better-sqlite3` for persistent storage.
The renderer gets the same proxy-based `CqrsClient` interface as the browser worker modes.

## Current state

Four-entry-point setup (main / preload / utility-process worker / renderer) implemented.
Default storage paths under `app.getPath('userData')/cqrs-client/`.
Reuses the same proxy/adapter machinery as the browser worker modes.

## Wings

- [`decisions/`](decisions/_overview.md) — ADRs scoped to this project.

## Where things live

- End-to-end tests (Playwright): `demos/hypermedia-electron/` — the demo's e2e suite primarily exercises this package's renderer / main / utility-process plumbing.
- Generated API docs: `packages/client-electron/docs/api/`
