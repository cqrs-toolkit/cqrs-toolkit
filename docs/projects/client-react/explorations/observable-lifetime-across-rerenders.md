# Observable lifetime across React re-renders

## Context

`@cqrs-toolkit/client-solid` uses Solid's fine-grained reactivity to give each hook a layered lifecycle:

- An **outer scope** keyed on `cacheKey` owns the long-lived state — the held cache-key hold, the `watchCollection` subscription, the `fetchVersion` counter — and tears it down only when the cache key changes.
- An **inner scope** keyed on `sort` / `filter` (or `params` / `page` for view queries) re-runs the fetch against the **same** held cache key. The watcher stays attached. The hold is never released.

This split matters because the client surface has visible side effects on hold release/reacquire: WS topic resubscribes, invalidation reordering, reseed attempts on the next acquire. Sort and filter tweaks must not pay those costs. The Solid tests assert this explicitly — see `keeps the watchCollection subscription attached across a sort change` and `refetches with new params when sort accessor changes — without releasing the cache key` in [`createListQuery.test.ts`](../../../../packages/client-solid/src/createListQuery.test.ts).

A naive React translation does not preserve this.
`useEffect(() => { ...subscribe... return () => unsubscribe(); }, [cacheKey, sort, filter])` re-runs the entire body on any change.
That tears the subscription down and reattaches, and (because cleanup runs first) releases the cache-key hold before the new one is held — exactly the side-effect cascade the Solid implementation avoids.

## The constraint

Every hook in `@cqrs-toolkit/client-react` must preserve runtime parity with its `client-solid` counterpart with respect to:

1. **Subscription continuity** — the same `watchCollection` (or `watchView`) subscription instance survives across in-session prop changes (sort, filter, page, params).
2. **Hold continuity** — the cache-key hold is acquired once per session and released once per session. In-session prop changes never release.
3. **Session boundary semantics** — the only inputs that legitimately tear down a session are the ones the Solid implementation calls out as session-restart inputs (`cacheKey` for list/item, `params`/`page` for view), and unmount.

## Candidate implementation pattern

The pattern the package will follow (subject to revision as the first hook lands):

- **Refs hold all long-lived state** — the subscription handle, the held cache key, the `fetchVersion` counter, the `settled` flag, the current `ListParams` snapshot. Refs survive renders without triggering them.
- **Per-input Subjects feed the rxjs pipeline** — one Subject per input that the hook reacts to (`cacheKey$`, `sort$`, `filter$`, …). Render-side `useEffect(..., [input])` blocks `.next()` new values into the relevant Subject. The Subject identity is stable; the pipeline subscription is set up once.
- **Mount-only `useEffect(..., [])` sets up the pipeline.** Its cleanup is the only place that disposes the subscription and releases the cache-key hold. No other effect tears down session state.
- **`useSyncExternalStore`** projects the underlying store snapshot into React's render output. Snapshot updates happen in the rxjs pipeline; the store notifies React.
- **Session restart is internal to the pipeline.** A `cacheKey$` emission routes through a `switchMap` (or equivalent) that unsubscribes the previous inner stream, releases the previous hold, then starts a fresh session. The outer subscription instance does not change.

This mirrors the Solid `createComputed(() => { …outer… createComputed(() => { …inner… }) })` shape but expresses the boundaries inside the rxjs graph instead of relying on the framework's reactive scope tree.

### Strict Mode

React 18 development re-mounts effects (mount → cleanup → mount). The pattern above survives this naturally because the mount-only effect's cleanup releases everything cleanly and the re-mount starts a fresh session. The pattern does **not** survive if the long-lived state lives in module scope or in a closure that outlives the second mount — refs are the right home.

## Why not just useMemo / useRef of the subscription?

Tempting shortcut: `useMemo(() => subscribe(...), [cacheKey])` plus an unmount-only `useEffect(() => () => unsubscribe(), [])`.

Two problems:

- `useMemo` is a cache hint; React is allowed to evict and recompute. The subscription cannot be tied to a value React might recompute on a whim — it must be tied to an effect whose cleanup React commits to running exactly once per setup.
- Even if `useMemo` were reliable here, this still re-creates the subscription on `cacheKey` change — which is _correct_ in that case, but it puts the session-restart logic outside the rxjs pipeline. Keeping it inside (`switchMap` driven by `cacheKey$`) means the outer subscription and the hooks below it stay stable, and the same teardown discipline applies whether the restart was triggered by `cacheKey` change or by something inside the pipeline (e.g., a `cache:key-reconciled` event for item queries).

## Status

Open while the first hooks are being implemented.
Resolves to a project-level pattern entry (`docs/projects/client-react/patterns/observable-lifetime.md`) once the pattern has been validated on at least two of the four hooks and the trade-offs are settled.

## Tests that pin the constraint

The ported unit tests are the executable specification.
The following names — lifted from `client-solid` — assert subscription / hold continuity and must pass against the React port:

- `refetches with new params when sort accessor changes — without releasing the cache key`
- `keeps the loading flag stable across a sort-driven refetch`
- `keeps the watchCollection subscription attached across a sort change`
- `refetches when the filter accessor changes — without releasing the cache key`
- `re-subscribes and releases old cache key when cacheKey accessor changes`
- `holds cache key on first fetch and releases on dispose`
- `unsubscribes on dispose`

If any of these regress during the port, the pattern above has failed and needs revision before the port continues.
