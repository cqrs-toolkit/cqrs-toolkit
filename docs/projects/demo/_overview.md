# Demo system

**Status:** Active
**Castle:** this directory (full inline castle, with three nested sub-project fractals)
**Public API:** not published — internal reference implementation
**Depends on (within repo):** every package (`client`, `client-electron`, `client-solid`, `hypermedia`, `hypermedia-client`, `hypermedia-cli`, `realtime`, `schema`, `devtools`)
**Depended on by (within repo):** none — terminal consumer

_Note on `devtools`._ Listed despite no direct source import.
The todo sub-project's e2e suite (`demos/todo-demo/tests/extension/`) _defines_ the devtools extension's end-to-end tests, making the extension an effective dep of the demo system.
This is a deliberate exception to the [direct-source-import counting rule](../_overview.md) — flagged so the rule's strictness elsewhere isn't softened by this one entry.

## Purpose

The demo system is the load-bearing reference implementation for the cqrs-toolkit packages.
It serves four equally-important goals — all of them load-bearing, none "good enough for a demo":

1. **Demonstrate effective client usage.**
   The demos are reference implementations showing best practices and patterns that promote performance in a larger application.
   Components follow the same patterns a real consumer would use; awkwardness or fragility in demo code is a signal the library API needs improvement, not a reason to add workarounds.
2. **End-to-end test the library.**
   The demos exercise the full public API and stated goals of the libraries under realistic conditions.
   E2e tests cover single-session, multi-session, with and without WebSocket propagation.
   Every user-facing library feature should have e2e coverage through a demo.
3. **Keep e2e tests simple and readable.**
   Tests should be easy to read at a glance.
   Dedicated CSS classes are used as stable selectors (e.g. `.note-item`, `.dash-note-title`) rather than fragile DOM-structure queries.
   Reusable test actions and assertions are extracted into `e2e-helpers.ts` files.
4. **Maintain strong debuggability.**
   When something breaks — automated or manual — the cause should be easy to identify.
   This includes useful logging, a command inspector page, observable client state, and clear loading/error states in the UI.
   Internal state is surfaced visually (CSS state classes, status indicators) over hidden.

## Sub-projects

The demo system is organized as three logical demos, each its own sub-project castle:

| Sub-project | Castle                                                     | Composing demo packages                                                    |
| ----------- | ---------------------------------------------------------- | -------------------------------------------------------------------------- |
| Todo        | [`projects/todo/`](projects/todo/_overview.md)             | `demos/base`, `demos/todo-demo`                                            |
| Hypermedia  | [`projects/hypermedia/`](projects/hypermedia/_overview.md) | `demos/hypermedia-base`, `demos/hypermedia-server`, `demos/hypermedia-web` |
| Electron    | [`projects/electron/`](projects/electron/_overview.md)     | `demos/hypermedia-electron`                                                |

Each sub-castle's own `_overview.md` carries that sub-project's `Depends on` list — the union of upstream `@cqrs-toolkit/*` packages imported by its composing demo packages.

`demos/base/` and `demos/hypermedia-base/` are shared base packages structured for code re-use across the actual demos, not separate demos in their own right.

## What belongs here

A new demo project becomes a sub-project under [`projects/`](projects/) when it composes multiple packages — exercising the toolkit as a unified system rather than illustrating one package in isolation.
This is the case for every demo currently in the monorepo, and is the expected case for future integrations and technology adapters.

| Demo characterization                                                                     | Lives at                                                                               | Examples                                      |
| ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------- |
| Composes multiple packages to demonstrate end-to-end behaviour                            | `docs/projects/demo/projects/<name>/` (here)                                           | `todo`, `hypermedia`, `electron`              |
| Future technology / framework integrations (e.g. Tauri, React, Vue, Svelte adapter demos) | `docs/projects/demo/projects/<name>/` (here)                                           | _none yet — system-level by definition_       |
| Exists to show one package in isolation, with no other-package composition                | That package's castle (e.g. as a small inline example in the package's `_overview.md`) | _none currently — would be a degenerate case_ |

In practice every demo in this monorepo composes the client with at least one other package, so they all live here.
A package-internal demo would be a degenerate case worth no more than a short inline example in that package's `_overview.md`.

When adding a new sub-project:

1. Create `docs/projects/demo/projects/<name>/_overview.md` (registry-style; describes the composing packages and their end-to-end behaviour).
2. Add the row to the "Sub-projects" table above.
3. Create the demo package(s) under `demos/<name>/` (one or more — a single demo can compose multiple physical packages, like the hypermedia demo's `hypermedia-base` + `hypermedia-server` + `hypermedia-web` triple).
4. Add a `CLAUDE.md` castle pointer in each new demo package.
5. Run `scripts/audit-links.sh`.

(If a second new sub-project lands using these steps, promote them into a `playbooks/` entry per the second-occurrence rule.)

## Always Read entries

- [`patterns/css-state-classes.md`](patterns/css-state-classes.md) — surface UI state as CSS classes for reliable e2e testing. Applies to every demo sub-project; bypassing it produces flaky tests.
- [`patterns/e2e-accept-headers.md`](patterns/e2e-accept-headers.md) — explicit `Accept` headers on all e2e HTTP requests so tests exercise the same content-negotiation paths the production client uses.

## Wings

- [`patterns/`](patterns/_overview.md) — demo-system normative conventions.

## Where things live

- Demo packages: `demos/todo-demo/`, `demos/base/`, `demos/hypermedia-base/`, `demos/hypermedia-server/`, `demos/hypermedia-web/`, `demos/hypermedia-electron/`
- E2e tests: alongside each demo package
