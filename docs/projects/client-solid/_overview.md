# @cqrs-toolkit/client-solid

**Status:** Active
**Castle:** this directory
**Public API:** experimental
**Depends on (within repo):** `client`
**Depended on by (within repo):** demos: `base`, `hypermedia-base`, `hypermedia-electron`, `hypermedia-web`, `todo-demo`

## Purpose

SolidJS reactive primitives for `@cqrs-toolkit/client`.
Provides `createListQuery` and `createItemQuery` — thin wrappers that bridge the client's query manager into SolidJS stores with fine-grained reactivity.
Peer dependency: `solid-js ^1.6.0`.

## Current state

Two primitives shipped (`createListQuery`, `createItemQuery`) using `createStore` + `reconcile` for stable identity in `<For>` loops, with automatic cache-key hold/release.

## Where things live

- Code: `packages/client-solid/`
- Unit tests: `packages/client-solid/src/**/*.test.ts` (beside source)
- Integration tests: `packages/client-solid/src/**/*.integration.test.ts` (beside source; `.integration.` suffix distinguishes scope)
- Generated API docs: `packages/client-solid/docs/api/`
- Public consumer-facing intro: `packages/client-solid/README.md`
- Package operational guidance: `packages/client-solid/CLAUDE.md`
