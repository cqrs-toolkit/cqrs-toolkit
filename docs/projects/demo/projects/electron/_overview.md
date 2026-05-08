# Electron demo

**Status:** Active
**Castle:** this directory
**Public API:** N/A
**Composing demo packages:** `demos/hypermedia-electron`
**Depends on (within repo):** `client`, `client-electron`, `client-solid`, `demo-base`, `hypermedia-base`
**Depended on by (within repo):** none — terminal consumer

## Purpose

Electron-targeted reference implementation, exercising `@cqrs-toolkit/client-electron`'s utility-process worker mode plus the hypermedia client stack.
The Electron renderer gets the same proxy-based `CqrsClient` interface as the browser worker modes.

## Current state

Single composing demo package: `hypermedia-electron`.
The renderer reuses the Solid app skeleton from `hypermedia-base` (shared with the Hypermedia web sub-project) and runs against the same `hypermedia-server` backend.
The main process bootstraps a utility-process worker that hosts the CQRS client; the renderer sees the same proxy-based `CqrsClient` interface as a browser running `dedicated-worker` or `shared-worker` mode.
Native SQLite via `better-sqlite3` runs in the utility process.

## Where things live

- E2e tests: `demos/hypermedia-electron/src/tests/*.e2e.ts`
- Run: `npm run start -w @cqrs-toolkit/hypermedia-electron` (builds renderer + electron, then launches; server must be running separately)
- Run server: `npm run server -w @cqrs-toolkit/hypermedia-electron` (proxies to `hypermedia-server`)
