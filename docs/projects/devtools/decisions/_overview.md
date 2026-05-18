# decisions/ (devtools)

ADRs scoped to `@cqrs-toolkit/devtools`.
Captures _why_ design choices specific to the extension were made.
Repo-wide decisions live in [`/docs/decisions/_overview.md`](../../../decisions/_overview.md).

## Decisions

- [ADR 0001 — Extension-installed in-worker `recordNetEvent` hook](0001-in-worker-hook-injection.md) — _Accepted 2026-05-17_ — extension installs the `recordNetEvent` surface in attached worker targets via CDP `Runtime.addBinding` + `Runtime.evaluate`. Mode-driven attachment (skip for online-only, install-only for dedicated-worker, install + `Network.enable` for shared-worker). CDP-native WS dropped at projection; the hook is the sole WS source.
- [ADR 0002 — Library-callable `recordNetEvent` surface on `__CQRS_TOOLKIT_DEVTOOLS__`](0002-record-net-event-surface.md) — _Accepted 2026-05-17_ — defines the `recordNetEvent` event shape, the `wrapWebSocket` helper, and the "CDP owns HTTP, hook owns WS" contract. Toolkit code (and user code) opts in by calling `wrapWebSocket` at WS construction sites.
