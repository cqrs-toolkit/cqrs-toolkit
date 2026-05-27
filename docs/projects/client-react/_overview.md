# @cqrs-toolkit/client-react

**Status:** Drafting
**Castle:** this directory
**Public API:** experimental
**Depends on (within repo):** `client`
**Depended on by (within repo):** _(none yet)_

## Purpose

React 18 hooks for `@cqrs-toolkit/client`.
Companion to [`client-solid`](../client-solid/_overview.md) — same API surface (params shape, returned state shape, lifecycle semantics), translated to React idioms.
Peer dependency: `react ^18.0.0`.

## Current state

Initial port in progress.
Targets parity with `client-solid` for `useListQuery`, `useItemQuery`, `useViewQuery`, `useEntityCacheKey`, `useScopeCacheKey`, plus a `CqrsProvider` / `useClient` context.

## Always Read entries

- [`explorations/observable-lifetime-across-rerenders.md`](explorations/observable-lifetime-across-rerenders.md) — the load-bearing implementation discipline for every hook in this package. Naive `useEffect`-with-deps would silently regress runtime behaviour the Solid implementation depends on (cache-key hold continuity, watcher subscription continuity across sort/filter changes).

## Wings

- [`explorations/`](explorations/_overview.md) — open design questions for the React port.

## Where things live

- Code: `packages/client-react/`
- Unit tests: `packages/client-react/src/**/*.test.ts(x)` (beside source)
- Integration tests: `packages/client-react/src/**/*.integration.test.ts(x)` (beside source; `.integration.` suffix distinguishes scope)
- Generated API docs: `packages/client-react/docs/api/`
- Public consumer-facing intro: `packages/client-react/README.md`
- Package operational guidance: `packages/client-react/CLAUDE.md`
