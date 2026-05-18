# ADR 0001 (devtools) — Extension-installed in-worker `recordNetEvent` hook

**Status:** Accepted 2026-05-17 (created 2026-05-17)

## Context

The Network panel needs to surface HTTP and WebSocket activity for every `@cqrs-toolkit/client` execution mode: `online-only`, `dedicated-worker`, and `shared-worker`.
Each mode places the CQRS client (sync-manager, command queue, WebSocket) in a different runtime context, which dictates how the panel can reach its traffic.

| Mode               | Where CQRS lives                | Reachable from panel context?        |
| ------------------ | ------------------------------- | ------------------------------------ |
| `online-only`      | Inspected page (main thread)    | Yes — page hook is already there     |
| `dedicated-worker` | Dedicated worker, child of page | No — separate JS context             |
| `shared-worker`    | SharedWorker, separate process  | No — separate JS context and process |

HTTP coverage was already in good shape via two complementary mechanisms:

- [`chrome.devtools.network.onRequestFinished`](https://developer.chrome.com/docs/extensions/reference/api/devtools/network) (HAR pipe) — runs in the panel context and reports the inspected tab's network. This includes the page and any dedicated workers it spawns (they live in the inspected-page process).
- CDP `Network.*` events — fired on debugger sessions we attach to. Needed for SharedWorker, which runs in its own process HAR can't see.

WebSocket _frames_ were the blocker.
The page-side hook ([`packages/devtools/src/hook/hook.ts`](../../../../packages/devtools/src/hook/hook.ts) line 14) was already established as `window.__CQRS_TOOLKIT_DEVTOOLS__` for commands/events but had no WS surface and no presence in worker globals.
[ADR 0002](0002-record-net-event-surface.md) defines the `recordNetEvent` surface that toolkit/user code calls on `__CQRS_TOOLKIT_DEVTOOLS__` to report WS frames; for that to work in `dedicated-worker` and `shared-worker` modes, the surface has to exist on `self` inside the worker.
That's what this ADR is for.

## Decision

The extension installs a `recordNetEvent` hook surface inside each attached worker target via CDP `Runtime.evaluate`.
The installed function pipes its argument through a CDP binding (`Runtime.addBinding`) back to the background, where the binding-call event is projected into the same `NetworkProbeEvent` shape page-hook events take.

The hook is _just_ the surface install — it does not monkey-patch `globalThis.WebSocket`, does not enumerate live WS instances, does not stamp markers on sockets.
It exists so that library code already running in the worker (`wrapWebSocket` inside `SyncManager`, or user-direct `recordNetEvent` calls) has a place to send events.

### Mode-driven attachment

Capture start now reads the client's `mode` (added to `CqrsDebugAPI` and forwarded via `MSG_CLIENT_DETECTED` / `MSG_BUFFER_DUMP`) and branches:

- `'online-only'` — no debugger attachment. The page hook is already there, the library calls land on it, HAR covers HTTP. Capture flips state to `'capturing'` and stops.
- `'dedicated-worker'` — attach to dedicated-worker targets (Brave reports them as `'other'`, Chrome as `'worker'`); install the hook; **skip `Network.enable`**. HAR covers their HTTP since dedicated workers live in the inspected-page process; CDP would double up.
- `'shared-worker'` — attach to SharedWorker; install the hook; **enable `Network.*`**. HAR can't see the SW process, so CDP is the sole HTTP source.

Child workers spawned under an attached parent (via `Target.setAutoAttach({ flatten: true })`) inherit the parent's `Network.enable` decision — children of a dedicated worker stay HAR-covered; children of a SharedWorker get CDP `Network`.

If the panel auto-starts capture before the client has registered, mode is unknown and capture surfaces an error rather than guessing.
The panel auto-start effect waits for `connection.mode()` to be defined.

### Installation sequence per worker attach

On each attach (whether top-level `chrome.debugger.attach({ targetId })` or a flat-mode auto-attached child), the extension issues, in order:

1. `Runtime.enable` — required for `Runtime.bindingCalled` events to fire.
2. `Network.enable` — only when the session isn't HAR-covered (i.e., SharedWorker mode and its children).
3. `Runtime.addBinding({ name: '__cqrsDevtoolsBinding' })` — safe to re-issue; the latest session's listener receives `Runtime.bindingCalled` events.
4. `Runtime.evaluate({ expression: HOOK_SCRIPT, returnByValue: true })` — one round trip; the script self-decides whether to install, refresh, or report failure, and returns a typed status.
5. `Target.setAutoAttach({ autoAttach: true, waitForDebuggerOnStart: true, flatten: true })` — so children spawn paused, get the hook installed, then resume.

The returned status is one of:

- `{ status: 'installed', version: N }` — fresh install.
- `{ status: 'already-installed', version: N }` — same-version sentinel matched; binding is re-routed by the `addBinding` call in step 3.
- `{ status: 'failed', error: string }` — install threw internally; caught by the script's own try/catch so the caller sees a typed result instead of a CDP exception.

Only `'failed'` produces a banner. Earlier iterations of this work emitted a success info banner to confirm the channel end-to-end; that's been removed now that the channel is trusted. Silent on the happy path.

If `Runtime.evaluate` itself returns `exceptionDetails` (a syntax error in the script, for example), that's surfaced as an error too — silent install failure was the bug that motivated the explicit-status pattern.

### Idempotency

The script:

- Checks `globalThis[__cqrsToolkitHookInstalled_v1__]`. If true, returns `'already-installed'` after refreshing the surface; the re-issued `addBinding` in step 3 routes future calls to the current listener.
- Otherwise installs/refreshes `self.__CQRS_TOOLKIT_DEVTOOLS__.recordNetEvent` and sets the sentinel.

Re-attach (DevTools reopened, conflict cleared, panel reloaded) re-runs the script; the same-version branch ensures one install per worker globalThis even across many panel cycles.

### Forward-migration contract

Each released version of the hook script must detect and handle every prior version's installation correctly.
Version N is responsible for safely upgrading or coexisting with installs v1 through v(N − 1).

Concretely, vN's responsibilities are:

- If `self[__cqrsToolkitHookInstalled_vN__] === true`: refresh `recordNetEvent` and return `'already-installed'`.
- If a different version's sentinel is set (`__cqrsToolkitHookInstalled_v*__` other than vN): overwrite `recordNetEvent` with the vN implementation, set the vN sentinel, and return `'installed'`. The previous sentinel may stay for diagnostic purposes; only the vN one is load-bearing.
- Otherwise: install fresh.

The rule is needed because long-running workers persist across extension reloads.
A SharedWorker can outlive many extension installs, including a v1 → v2 extension upgrade.
The forward-migration logic must be baked into the script itself rather than checked from the extension side, because the install state lives in the worker's globalThis.

The current shipped version is v1; the contract takes effect at the first version bump.
A code comment beside the `SENTINEL_KEY` constant in [`packages/devtools/src/background/worker-hook-script.ts`](../../../../packages/devtools/src/background/worker-hook-script.ts) restates this contract so it's readable from the code, not only from the ADR.

### CDP-native WebSocket events dropped

CDP's `Network.webSocketCreated`, `webSocketFrameSent`, `webSocketFrameReceived`, and `webSocketClosed` are deliberately dropped at the projection point in [`packages/devtools/src/background/network-capture.ts`](../../../../packages/devtools/src/background/network-capture.ts).
On the sessions where `Network.enable` is on (SharedWorker subtrees) CDP still fires them, but they're discarded before reaching the panel.

Two reasons:

- **No URL for pre-existing connections.** CDP only emits `webSocketCreated` for connections opened after `Network.enable`. For the CQRS WS opened at worker startup, the panel would see frames with no `webSocketCreated` → no URL → empty path/url columns. The library hook path (per ADR 0002) always carries `url` on every frame, by construction.
- **Duplicates.** When a connection arrives via both CDP and the library hook (post-attach SharedWorker traffic, for instance), the panel renders two rows per frame — one with URL, one without. Routing WS exclusively through the hook gives one row per frame, always with URL.

Side benefit: Vite HMR ping/pong frames inside the page are auto-filtered, since they never go through `wrapWebSocket` or the worker hook.

The contract is "CDP owns HTTP, hook owns WS."

## Alternatives considered

### Extension monkey-patches `globalThis.WebSocket` in workers

A previous iteration injected a script that replaced `self.WebSocket` with a wrapper, marked instances with `__cqrsToolkitWrapped__`, and even retroactively wrapped pre-existing instances via `Runtime.queryObjects` + `Runtime.callFunctionOn`.

Rejected after implementation experience. Problems we hit:

- Built-in `WebSocket` subclassing via `class extends` produced silent failures in some worker contexts — the IIFE threw, `Runtime.evaluate` returned no `result.value` (or one we weren't reading), and the panel showed zero frames with no error banner.
- Even with a function-constructor variant that avoided the class-extends edge case, the patch only covered connections constructed _after_ install — the most important case (the long-lived CQRS WS in a SharedWorker) needed `Runtime.queryObjects` retroactive wrapping anyway, which added another silent-failure surface.
- The library-hook path (ADR 0002, `wrapWebSocket` in `SyncManager`) covers exactly what we need: every WS the toolkit opens, plus every WS user code voluntarily wraps. Non-CQRS WSes in user code without `wrapWebSocket` are an explicit non-goal — the user can call `recordNetEvent` themselves.

Surface-area reduction beat coverage breadth.

### Library wiring only, no extension install in workers

Solve everything through `wrapWebSocket` and direct `recordNetEvent` calls in toolkit/user code, with no hook installation step at all.

Rejected because `recordNetEvent` on `__CQRS_TOOLKIT_DEVTOOLS__` only works if the property exists. On the page, the hook IIFE installs it. In workers, _something_ has to install it, and the only path the extension has into a worker is CDP `Runtime.evaluate`. So we keep the hook install — just not the WebSocket monkey-patch.

### Tab-level debugger attach

Attach `chrome.debugger` to the inspected tab so `Network` events flow for the page and all child workers via `setAutoAttach`.

Rejected because the tab's debugger client is already DevTools.
`chrome.debugger.attach({ tabId })` returns `-32000 "Not allowed"` whenever the inspected page has its own DevTools window open, which is the entire use case.

### `Page.addScriptToEvaluateOnNewDocument`

CDP's page-scoped script-injection method.
Rejected because it applies only to page targets — not workers — and we don't have an attached page session.

## Consequences

### Implementation impact

- Worker-side hook script ([`worker-hook-script.ts`](../../../../packages/devtools/src/background/worker-hook-script.ts)): self-contained IIFE that installs `self.__CQRS_TOOLKIT_DEVTOOLS__.recordNetEvent`, sets a versioned sentinel, returns status by value. Constants for `BINDING_NAME`, `SENTINEL_KEY`, `DEVTOOLS_GLOBAL` exported for reuse.
- Extension-side installer (`installWorkerHook` on `NetworkCaptureManager`): runs the 5-step sequence, reads status, surfaces failures as state errors, silent on success.
- Mode flows end-to-end: `CqrsDebugAPI.mode` → `MSG_CLIENT_DETECTED.mode` → `TabBuffer.mode` (so `MSG_BUFFER_DUMP` carries it across panel reconnects) → `connection.mode()` signal → `MSG_NET_CAPTURE_START.mode` → `NetworkCaptureManager.start`'s branch.
- Per-target attach state tracks `harCoveredTopLevels: Set<string>` so `Network.enable` is skipped on dedicated-worker subtrees.
- CDP-native `Network.webSocket*` cases removed from the projection switch; binary-preview / base64 helpers used only by those cases removed.
- `selectWorkerTargetsForMode` replaces the generic worker filter; scoped per mode, with `'other'` typing accepted for Brave's dedicated workers (URL pattern check).
- Re-enumeration loop polls `chrome.debugger.getTargets()` every 2s while capturing, so workers spawned after capture start are caught.

### Operational implications

#### Gains

- Online-only mode never engages the debugger; nothing to fail, nothing to block.
- Dedicated workers in Brave/Chrome work via the same code path. URLs come through correctly on WS frames in every mode.
- Re-attach (DevTools reopened, extension reloaded) is safe — sentinel detection prevents double-install and the binding name is stable across sessions.
- Failure modes are loud: any `Runtime.evaluate` exception or script-internal throw shows up as a state error banner, named per-target.

#### Costs

- WebSockets opened in a worker by user code that doesn't use `wrapWebSocket` or `recordNetEvent` are invisible. The earlier WebSocket monkey-patch would have caught those automatically; this is the trade-off for surface-area reduction.
- `Runtime.evaluate` happens once per attached worker per panel-attach lifecycle. Cheap, but worth noting that re-attach overhead scales linearly with the number of workers in the inspected tab.

### Coding implications

#### Gains

- The patch IIFE is small and self-contained; ~40 lines including the try/catch and migration-comment block.
- One install path; one place where `__CQRS_TOOLKIT_DEVTOOLS__` is established in workers. Consumer code on either side (toolkit / user) doesn't need to know whether it's running on the page or in a worker.
- The mode-driven branch is explicit in `NetworkCaptureManager.start`; readers don't have to infer behaviour from URL heuristics.

#### Costs

- The forward-migration contract is contract-on-the-script: vN must contain the v1..v(N − 1) detection logic. v1 has nothing to migrate from; v2 onwards will need to walk known prior sentinels. Bounded but real.
- The comment beside `SENTINEL_KEY` must restate the contract when the script is touched. Falling out of sync with this ADR would be a silent castle drift; the comment is the primary defence.

## Related

- [`/docs/projects/devtools/_overview.md`](../_overview.md) — wing index.
- [`packages/devtools/src/hook/hook.ts`](../../../../packages/devtools/src/hook/hook.ts) — the page-side hook IIFE; establishes `__CQRS_TOOLKIT_DEVTOOLS__` on `window`. The worker-side hook mirrors the same global-prop name on `self`.
- [ADR 0002 — Library-callable `recordNetEvent` surface on `__CQRS_TOOLKIT_DEVTOOLS__`](0002-record-net-event-surface.md) — defines the surface this ADR installs; sole WS source.
