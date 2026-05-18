# @cqrs-toolkit/devtools

**Status:** Active
**Castle:** this directory
**Public API:** N/A
**Depends on (within repo):** `client`
**Depended on by (within repo):** none — terminal consumer

## Purpose

Chrome DevTools extension for debugging `@cqrs-toolkit/client` applications.
Adds a **CQRS Toolkit** panel to Chrome DevTools that shows live command state, WebSocket events, gap detection, and storage inspection.

## Current state

Pre-release.
Manifest V3 extension with four execution contexts (hook, content script, background service worker, panel).
Discovers an in-page `__CQRS_TOOLKIT_DEVTOOLS__` debug API and forwards sanitised events through the chrome.runtime port boundary.

## Wings

- [`decisions/`](decisions/_overview.md) — ADRs scoped to this project.

## Where things live

- Code: `packages/devtools/`
- Unit tests: `packages/devtools/src/**/*.test.{ts,tsx}` (beside source)
- End-to-end tests (Playwright): `demos/todo-demo/tests/extension/` — config lives in the `todo-demo` project, which serves as the test harness (Playwright drives a real browser running both the demo app and the extension). Owned by the demo project; surfaced here because the suite primarily exercises this extension.
- Public consumer-facing intro: `packages/devtools/README.md`
- Package operational guidance: `packages/devtools/CLAUDE.md`
- Built extension output: `packages/devtools/dist/` (load-unpacked target)
