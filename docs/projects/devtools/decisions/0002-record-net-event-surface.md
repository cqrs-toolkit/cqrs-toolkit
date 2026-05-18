# ADR 0002 (devtools) — Library-callable `recordNetEvent` surface on `__CQRS_TOOLKIT_DEVTOOLS__`

**Status:** Accepted 2026-05-17 (created 2026-05-17)

## Context

The Network panel needs WebSocket frame coverage in every `@cqrs-toolkit/client` execution mode.
Each mode places the CQRS WebSocket in a different context (page main thread, dedicated worker, SharedWorker), and not all contexts are reachable by the same mechanism:

- **CDP `Network` domain.** Captures WS frames at the network-stack layer, but only for connections opened after `Network.enable`. The CQRS WS opens at worker startup — long before the panel attaches — so the most important connection has no `webSocketCreated` event and arrives without a URL. Frames render with empty path/url columns.
- **HAR pipe.** Captures the WS upgrade as a single HTTP entry. Never carries frames.
- **Tab-level debugger attach.** Would let us instrument the page, but is blocked by DevTools owning the tab debugger (`-32000 "Not allowed"`).

The toolkit, however, holds the WebSocket reference itself in every mode — `SyncManager.openAuthenticatedWebSocket` constructs the socket.
If toolkit code voluntarily reports what it's doing, every mode's CQRS WS is covered uniformly, with URLs known by construction, no race against pre-existing connections, no separate code path per mode.
The `__CQRS_TOOLKIT_DEVTOOLS__` global is the existing library↔extension surface for commands and events ([`packages/devtools/src/hook/hook.ts`](../../../../packages/devtools/src/hook/hook.ts) line 14); adding a network-event method is the natural extension.

[ADR 0001](0001-in-worker-hook-injection.md) covers _installing_ the surface in worker contexts via CDP `Runtime.evaluate`.
This ADR covers _what the surface is_ and how callers use it.

## Decision

Extend `__CQRS_TOOLKIT_DEVTOOLS__` with a `recordNetEvent(event: NetEventInput): void` method.
The method is the single public surface for pushing network observations into the panel from any execution context.
The page-side IIFE installs it on `window`; the worker-side hook (ADR 0001) installs it on `self`.

Library code (`SyncManager` and any other internal WS opener) calls it unconditionally via the `wrapWebSocket` helper — coverage doesn't depend on which mode is in use.
User code (custom transports, worker WS not opened by the toolkit, non-CQRS WS on the page) calls it the same way.

This surface is the **sole** WS-event source the panel renders.
CDP-native `Network.webSocket*` events are dropped at the projection point in [`packages/devtools/src/background/network-capture.ts`](../../../../packages/devtools/src/background/network-capture.ts) — they had no URL for pre-existing connections and produced URL-less duplicate rows alongside the hook path. See [ADR 0001 §CDP-native WebSocket events dropped](0001-in-worker-hook-injection.md).

The contract is **"CDP owns HTTP, hook owns WS."**

### Event shape

A typed discriminated union, exported from `@cqrs-toolkit/client`:

```ts
type NetEventInput =
  | { kind: 'ws-created'; connectionId: string; url: string; protocols?: string[] }
  | {
      kind: 'ws-frame-sent'
      connectionId: string
      url?: string
      payload: string | ArrayBuffer | ArrayBufferView
      timestamp?: number
    }
  | {
      kind: 'ws-frame-received'
      connectionId: string
      url?: string
      payload: string | ArrayBuffer | ArrayBufferView
      timestamp?: number
    }
  | { kind: 'ws-closed'; connectionId: string; code?: number; reason?: string; wasClean?: boolean }
```

- `connectionId` is caller-supplied, opaque, and stable for the lifetime of one WS connection. The panel keys frames to the lifecycle pair (`ws-created` opens, `ws-closed` terminates) by this ID. To avoid colliding with CDP-source identifiers (used for HTTP rows), the projection namespaces the panel-side row id as `library:<connectionId>`.
- Frame variants carry an optional `url` field. `wrapWebSocket` always includes it; bare `recordNetEvent` callers should too. The panel reads it directly so `ws-frame` rows render path/url even when `ws-created` was dropped at the source — common in shared-worker mode, where the CQRS WS opens at worker startup before the panel hook was installed.
- Payloads accept `string`, `ArrayBuffer`, or `ArrayBufferView`. The hook normalises binary into a `[binary, N B] aa bb cc …` preview. Blob is deliberately omitted (reading is async).
- HTTP variants are deliberately omitted — HAR (page + dedicated worker) and CDP `Network` (shared worker) already cover HTTP in every mode; adding a third HTTP source would invite duplication.

### `wrapWebSocket` helper

Most call sites want lifecycle + frames reported automatically.
The toolkit exports from [`packages/client/src/devtools/wrapWebSocket.ts`](../../../../packages/client/src/devtools/wrapWebSocket.ts):

```ts
function wrapWebSocket(ws: WebSocket, opts: { connectionId: string }): WebSocket
```

It captures `socket.url` in closure, emits a `ws-created` event immediately, overrides `socket.send` for outgoing frames, and adds `'message'` + `'close'` listeners. Returns the same socket so the call stays one line at the construction site:

```ts
const socket = wrapWebSocket(new WebSocket(url), { connectionId: generateId() })
```

`SyncManager.openAuthenticatedWebSocket` uses this for the CQRS WS. User code can use it for any WS they want surfaced.
Bare `recordNetEvent` calls are the escape hatch for non-WS transports or non-standard event shapes (custom binary protocols, BroadcastChannel, etc.).

### Bridge plumbing

Two equivalent install paths terminate in the same `NetworkProbeEvent` stream on the panel side.

- **Page (online-only and any page-side WS):** the IIFE in [`packages/devtools/src/hook/hook.ts`](../../../../packages/devtools/src/hook/hook.ts) installs `recordNetEvent` on `window.__CQRS_TOOLKIT_DEVTOOLS__`. It projects the input into the wire `NetworkProbeEvent` shape locally and posts `MSG_NET_EVENT` via `window.postMessage`. The content script forwards to background, which forwards to the panel — the same hop sequence commands and events take.
- **Worker (dedicated-worker, shared-worker, including their flat-mode children):** the script from ADR 0001 installs `recordNetEvent` on `self.__CQRS_TOOLKIT_DEVTOOLS__`. The function pipes the event JSON through `__cqrsDevtoolsBinding`, which fires `Runtime.bindingCalled` back to the debugger session. The background's binding handler projects into the same `NetworkProbeEvent` shape and forwards to the panel.

The network store sees one event stream regardless of source. Row source (`page` vs `worker`) is inferred from `event.session.targetType` so library frames carry the correct label.

## Alternatives considered

### Library wiring only, no extension install

Skip ADR 0001 entirely; require all WS observations to come through `recordNetEvent` calls.

Partially adopted but not viable on its own: `recordNetEvent` on `__CQRS_TOOLKIT_DEVTOOLS__` requires the property to exist in the calling context. On the page, the hook IIFE installs it. In workers, _something_ has to install it — ADR 0001's purpose. So library wiring covers the call site, ADR 0001 covers the surface install. The two are complements, not alternatives.

### Extension-side WebSocket monkey-patch in workers

Inject a script that replaces `globalThis.WebSocket` with a wrapper that auto-reports every constructed WS — covering user-code WS not opened via `wrapWebSocket`.

Considered and implemented during this work, then dropped (see ADR 0001 alternatives). Built-in `WebSocket` subclassing had silent failure modes that left the panel empty without a banner; retroactive wrapping via `Runtime.queryObjects` added another silent surface; pre-existing connections still required the library path anyway. Trade was: explicit opt-in via `wrapWebSocket` in exchange for a predictable, debuggable channel. Non-CQRS user-code WS in workers without `wrapWebSocket` is the explicit non-goal.

### `chrome.devtools.inspectedWindow.eval` patch on the page

Inject a WebSocket monkey-patch into the page from the panel context, with the patch postMessaging frames to a content-script bridge.

Rejected as the primary path because (a) it runs after page load, so early WS opens race the patch, and (b) it requires the extension to inject custom JS into the inspected page — more invasive than asking the toolkit to call its own hook.
Reserved as a possible future opt-in for users who want non-CQRS page-WS coverage without modifying their code.

### CDP `Network.webSocket*` as a coexisting source

Let CDP and the hook both report; dedupe per-frame in the panel store.

Rejected because the dedup is fragile (CDP requestId namespace doesn't share with library connectionId) and the CDP path can't supply URLs for pre-existing connections. With the hook as the sole source, every row has URL, every frame matches its lifecycle, and Vite HMR ping/pong noise auto-filters out (Vite never goes through `recordNetEvent`).

## Consequences

### Implementation impact

- `@cqrs-toolkit/client` exports `recordNetEvent`, `wrapWebSocket`, and the `NetEventInput` type from [`packages/client/src/devtools/wrapWebSocket.ts`](../../../../packages/client/src/devtools/wrapWebSocket.ts).
- `SyncManager.openAuthenticatedWebSocket` ([`packages/client/src/core/sync-manager/SyncManager.ts`](../../../../packages/client/src/core/sync-manager/SyncManager.ts) line 1316) wraps every CQRS WS construction.
- Page-side hook IIFE installs `recordNetEvent` on `window.__CQRS_TOOLKIT_DEVTOOLS__`, projects to `NetworkProbeEvent`, posts `MSG_NET_EVENT`.
- Worker-side hook (per ADR 0001) installs `recordNetEvent` on `self.__CQRS_TOOLKIT_DEVTOOLS__`, routes through `__cqrsDevtoolsBinding`.
- Background: content-port handler forwards `MSG_NET_EVENT` to the panel; binding handler projects bound-event payloads into `NetworkProbeEvent` shape.
- Panel network store: handles WS-event variants, infers row `source` from `event.session.targetType` (`'page'` vs anything-else → `'worker'`), prefers per-frame `url` over the `wsUrlByConnection` map.
- `NetEventWebSocketFrame.url?: string` added to the wire type so frame rows render path/url even when `ws-created` was dropped at the source.

### Operational implications

#### Gains

- One mechanism covers all three execution modes uniformly. The CQRS WS appears in the Network panel with URL on every frame, in every mode, with no race against panel-attach timing.
- Vite HMR ping/pong frames are auto-filtered (Vite doesn't call `recordNetEvent`).
- Public surface for users: any custom WS (or non-WS transport) can be made visible by a one-line `wrapWebSocket` call or a direct `recordNetEvent` call.

#### Costs

- Non-CQRS user-code WebSockets are invisible unless the user opts in via `wrapWebSocket` or `recordNetEvent`. The panel is honest about what it shows (no false claim of "all WS traffic"); documented as a deliberate scope choice.
- The toolkit becomes responsible for opt-in tracking of any WS it wants visible. New `SyncManager`-like components must remember to use `wrapWebSocket`. Forgetting leaves the WS invisible across all modes.

### Coding implications

#### Gains

- One public surface name (`__CQRS_TOOLKIT_DEVTOOLS__.recordNetEvent`), two install paths (page IIFE / worker hook), one event stream on the panel side. Consumer code doesn't need to know whether it's on the page or in a worker.
- No dedup state needed anywhere; per-frame `url` + namespaced `recordId` keeps rows independent.
- `wrapWebSocket` is callable from any context; it looks up the hook via `globalThis.__CQRS_TOOLKIT_DEVTOOLS__` at call time and no-ops if absent. Toolkit code doesn't need `if (devtoolsAvailable)` guards.

#### Costs

- `wrapWebSocket`, `recordNetEvent`, and `NetEventInput` are public API surface on `@cqrs-toolkit/client`. Their shapes are constrained by the pre-release backwards-compatibility posture; see [`packages/devtools/CLAUDE.md`](../../../../packages/devtools/CLAUDE.md).
- The CDP-native WS drop means we no longer have any backstop for WS we don't opt in on. The trade is honest scope vs. brittle URL-less duplicate rows; we picked honesty.

## Related

- [ADR 0001 — Extension-installed in-worker `recordNetEvent` hook](0001-in-worker-hook-injection.md) — installs the surface this ADR defines, in worker contexts.
- [`packages/client/src/devtools/wrapWebSocket.ts`](../../../../packages/client/src/devtools/wrapWebSocket.ts) — public helper + type definition.
- [`packages/devtools/src/hook/hook.ts`](../../../../packages/devtools/src/hook/hook.ts) — page-side install + projection.
- [`packages/devtools/src/background/network-capture.ts`](../../../../packages/devtools/src/background/network-capture.ts) — worker-side projection + CDP-native WS drop.
- [`packages/devtools/README.md`](../../../../packages/devtools/README.md) — consumer-facing intro that should grow a "Feeding custom network events" section pointing here.
