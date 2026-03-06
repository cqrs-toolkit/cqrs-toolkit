# 14. DevTools

## 14.1 Library-Side Prep

This section describes what the library needs **before** the extension exists.
These changes are small, low-risk, and make the library more debuggable in general.
Build these incrementally as you work on the library — don't batch them.

### 14.1.1 DevTools Config Entry Point

The `debug` config option already exists in `CqrsClientConfig` but is unused.
Repurpose it as the devtools gate:

```typescript
// types/config.ts — no new fields needed, just use what's there
interface CqrsClientConfig<TCommand, TEvent> {
  // ... existing fields ...
  debug?: boolean // already exists
}
```

When `debug` is true, the client:

1. Registers itself on `window.__CQRS_TOOLKIT_DEVTOOLS__` (main thread only).
2. Emits debug-only events on the event bus (prefixed `debug:`).
3. In worker modes, registers additional debug RPC methods on the worker message handler.

When `debug` is false or absent, none of this happens — zero overhead.

> **Note:** `debug: true` must never ship to production. Consider a build-time lint rule or warning to enforce this.

**Implementation pattern:**

```typescript
// createCqrsClient.ts — after all components are wired
if (resolvedConfig.debug && typeof window !== 'undefined') {
  const debugAPI: CqrsDebugAPI = {
    events$: adapter.events$,
    commandQueue,
    queryManager,
    cacheManager,
    syncManager,
    storage: adapter.storage,
    config: resolvedConfig,
    role: adapter.role, // 'leader' | 'standby'
  }

  const hook = (window as any).__CQRS_TOOLKIT_DEVTOOLS__
  if (hook?.registerClient) {
    hook.registerClient(clientId, debugAPI)
  }
}
```

The extension injects `__CQRS_TOOLKIT_DEVTOOLS__` via a `document_start` content script before the client loads.
If the hook isn't there, the client does nothing.
If the hook is there but `debug` is false, the client does nothing.
Both sides must opt in.

### 14.1.2 Tab Role Awareness

In SharedWorker mode, SQLite and sync live in the dedicated worker of the leader tab.
The SharedWorker itself has no `window`, so debug event streams originate from the leader tab's window context.
A DevTools panel attached to a standby tab will only see events broadcast by the SharedWorker — not storage-level events.

The `CqrsDebugAPI` registration therefore includes a `role` field (`'leader'` | `'standby'`).
The panel shows a banner on standby tabs:

> "This tab is in standby mode — attach DevTools to the leader tab for full visibility."

### 14.1.3 Debug Events to Close the Gap

`adapter.events$` (the existing `LibraryEvent` stream) covers ~80% of what devtools needs.
The remaining 20% requires new debug-only events.
These are only emitted when `debug: true`.

Add these to `LibraryEventType`:

| Event                        | Payload                                                                    | Why                                                                                                |
| ---------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `debug:ws-event-received`    | `{ event: ParsedEvent }`                                                   | Raw WebSocket event before processing — the events tab needs this                                  |
| `debug:ws-event-processed`   | `{ event: ParsedEvent, results: ProcessorResult[], invalidated: boolean }` | What the event processor did with it                                                               |
| `debug:gap-detected`         | `{ streamId, expected, received }`                                         | Revision gap detected on a stream                                                                  |
| `debug:gap-repair-started`   | `{ streamId, fromRevision, toRevision }`                                   | Fetching missing events                                                                            |
| `debug:gap-repair-completed` | `{ streamId, eventCount }`                                                 | Gap filled                                                                                         |
| `debug:cache-key-acquired`   | `{ key, collection, params, evictionPolicy }`                              | Cache key created/touched — **this is how devtools maps opaque UUIDs back to collection + params** |
| `debug:refetch-scheduled`    | `{ collection, debounceMs }`                                               | Debounced refetch queued                                                                           |
| `debug:refetch-executed`     | `{ collection, recordCount }`                                              | Refetch completed                                                                                  |
| `debug:command-sent`         | `{ commandId, correlationId, service, type, payload }`                     | Command dispatched to server                                                                       |
| `debug:command-response`     | `{ commandId, correlationId, response, events }`                           | Server response with extracted events                                                              |

**Cache key mapping note:**
Cache keys are UUIDv5 hashes — collection and params cannot be recovered from the key alone.
The `debug:cache-key-acquired` event is the mechanism for the devtools to build a reverse lookup.
This is emitted from `CacheManager.acquire()` and carries the original collection + params.

**Payload size note:**
`debug:ws-event-received` carries raw `ParsedEvent` objects which may be large on high-throughput streams.
Consider a `debugPayloadTruncation` config option, or truncate in the hook before posting through the `postMessage` chain, to avoid serialization overhead at volume.

**Command correlation note:**
`debug:command-sent` and `debug:command-response` both carry a `correlationId` to support end-to-end tracing across retries and batched responses.

### 14.1.4 Worker Debug RPC Methods

In dedicated-worker and shared-worker modes, storage and sync live in the worker.
The existing `WorkerMessageHandler.registerMethod()` protocol supports adding debug methods.

When `debug: true`, register these additional methods in the worker:

```
debug.getCommandSnapshot()      → CommandRecord[]
debug.getCacheKeySnapshot()     → CacheKeyRecord[]
debug.getCollectionSyncStatus() → CollectionSyncStatus[]
debug.getReadModels(collection) → ReadModelRecord[]
debug.getCachedEvents(filter)   → CachedEventRecord[]
debug.getStorageStats()         → { commands, cacheKeys, events, readModels } (counts)
```

These are thin wrappers over existing storage methods.
The worker already has `storage.getCommands()`, `storage.getAllCacheKeys()`, etc. — the debug methods just expose them under a `debug.*` namespace.

Debug events from worker-side components (SyncManager, etc.) are broadcast to all connected windows via the existing `messageHandler.broadcastEvent()` path.

### 14.1.5 What NOT to Build Yet

- No `window.__CQRS_TOOLKIT_DEVTOOLS__` hook implementation (the extension provides this).
- No UI, panel, or visualization code.
- No performance profiling hooks.

Just the events, the config gate, and the worker RPC methods.
These make the library more observable in general (console debugging benefits too).

---

## 14.2 Monorepo Package

The devtools extension lives in this monorepo as a workspace package.
This keeps shared types (`CommandRecord`, `CacheKeyRecord`, `LibraryEvent`, etc.) in sync with the client — no version drift.
Type imports from `@cqrs-toolkit/client` are build-time only and erased at compile — no runtime dependency on the client bundle.

```
packages/
  client/                        # existing — emits debug events, exposes CqrsDebugAPI
  devtools/                      # new — Chrome extension + page hook (single package)
```

The hook is small enough to live in the same package as the extension.
It's a `postMessage` relay with an activation guard — ~100 lines.
Both the hook and the extension panel import types from `@cqrs-toolkit/client` at build time only.

`packages/devtools` is `"private": true` — it's a built Chrome extension, not published to npm.
Same pattern as `demos/todo-demo`.

### 14.2.1 Package Structure

```
packages/devtools/
├── package.json               # private, workspace member
├── tsconfig.json              # extends packages/tsconfig.common.json
├── manifest.json              # Chrome Manifest V3
├── vite.config.ts             # Multi-entry: hook (IIFE), content-script, background, panel (ESM)
├── src/
│   ├── hook.ts                # Injected into page at document_start
│   │                          # Defines window.__CQRS_TOOLKIT_DEVTOOLS__
│   │                          # Subscribes to CqrsDebugAPI.events$
│   │                          # Relays via window.postMessage
│   │                          # IMPORTANT: compiled as standalone IIFE — no runtime imports
│   ├── content-script.ts      # Bridge: window.postMessage ↔ chrome.runtime
│   ├── background.ts          # Service worker: port management + event buffer
│   ├── devtools.ts            # chrome.devtools.panels.create("CQRS Toolkit", ...)
│   └── panel/                 # Panel UI — SolidJS app
│       ├── App.tsx
│       ├── tabs/
│       │   ├── CommandsTab.tsx
│       │   ├── EventsTab.tsx
│       │   ├── CacheTab.tsx
│       │   ├── ReadModelsTab.tsx
│       │   ├── SyncTab.tsx
│       │   └── StorageTab.tsx
│       └── components/        # Shared UI (JSON viewer, table, filters)
├── public/
│   └── panel.html
└── dist/                      # Built extension (load unpacked from here)
```

### 14.2.2 Build Pipeline

Vite with `build.rollupOptions.input` for four separate entry points:

- **hook** — `format: 'iife'`, `inlineDynamicImports: true`. Must be a self-contained IIFE; runs in page context with no module loader available at runtime.
- **content-script** — standalone IIFE, same constraints as hook.
- **background** — standalone, MV3 service worker.
- **panel app** — standard ESM, SolidJS, full bundling.

The hook receives a live Observable instance passed in from the already-loaded client and calls `.subscribe()` directly on it. It imports nothing at runtime. This is intentional — do not add runtime imports to hook.ts.

### 14.2.3 Communication Flow

```
┌─────────────┐    window.postMessage    ┌────────────────┐    chrome.runtime    ┌──────────────┐
│  Page        │ ◄─────────────────────► │ Content Script  │ ◄────────────────► │ DevTools Panel │
│  (hook.ts)   │                         │                 │                    │               │
│              │                         │                 │                    │               │
│  CqrsClient  │                         │                 │                    │               │
│  debug API   │                         │                 │                    │               │
└─────────────┘                          └────────────────┘                    └──────────────┘
```

1. **hook.ts** is injected at `document_start` via the content script.
   It defines `window.__CQRS_TOOLKIT_DEVTOOLS__` with a `registerClient(id, api)` method.
   When the client registers, the hook subscribes to `api.events$` and forwards events via `window.postMessage`.

2. **content-script.ts** listens for `window.postMessage` with a known type prefix (`__CQRS_DEVTOOLS__`).
   Relays to the DevTools panel via `chrome.runtime.connect()` port.

3. **DevTools panel** receives events and renders.
   Sends commands back (retry, evict, force sync) through the same channel in reverse.

### 14.2.4 Activation Guard

The hook sets an `active` flag, initially `false`.
When the DevTools panel opens, it sends an `activate` message through the chain.
The hook flips `active = true` and starts subscribing to `events$`.
When the panel closes, `deactivate` is sent and subscriptions are torn down.

This means **zero overhead when DevTools is closed** — no subscriptions, no message serialization.

### 14.2.5 Session Model and Buffer Persistence

The background service worker holds the event buffer in plain JS memory (not IndexedDB or any storage API).
This is intentional: debug data has different retention semantics than application data and must never touch the client's SQLite database.

**Session boundary: auth state change, not page load.**
The library has an explicit auth hook that wipes all state and restarts from blank when the user ID changes (including sign-out).
Auth state changes are observable on the existing event bus.
The DevTools panel uses auth change as the hard session boundary — not page navigation.

Session boundary behaviour:

- The hook forwards auth change events through the relay chain.
- On receiving an auth change, the background clears its buffer.
- The panel inserts a visible **"User changed — session reset"** divider in all log views.
- Data from before the boundary remains visible above the divider.

Page reloads and SPA navigations do **not** clear the buffer. The library state wipes on full reload, but the DevTools panel retaining pre-reload data is useful for debugging initialization sequences — the divider is not needed here since the client will re-register via `registerClient` and the panel will receive fresh snapshots naturally.

**Buffer retention:**
The background holds the full current session — all events since the last auth boundary — unbounded.
There is no fixed event count cap. A session that produces an unusually large volume of events is a signal worth seeing, not hiding behind an arbitrary limit.
The panel renders a windowed view of the tail using virtual scrolling (`solid-virtual` or equivalent), so DOM count is not the constraint.

**MV3 service worker termination:**
Chrome may terminate the background service worker after inactivity.
If the buffer is lost due to service worker restart, the panel shows: "Session data was cleared — service worker restarted."
This is acceptable behaviour; do not over-engineer around it.

### 14.2.6 Multi-Client Support

One `createCqrsClient` instance per domain is enforced by the library.
The hook handles exactly one registered client. No client selector UI is needed.

---

## 14.3 Panel UI

### 14.3.1 Framework and State Management

**Framework:** SolidJS — consistent with the demo app, and fine-grained reactivity is well-suited to streaming event logs where individual rows update without re-rendering the whole list.

**State management:** Solid's own primitives throughout — no external state library.

- `createSignal` for scalar state (active tab, filter values, connection status).
- `createStore` for structured objects (snapshots, collection sync state).
- Signal-wrapped arrays for append-only logs (Events Tab, activity logs) — unbounded per session, windowed via virtual scrolling for rendering.

### 14.3.2 Theming

`chrome.devtools.panels.themeName` returns `"dark"` or `"default"`.
Inject this as a class on the panel root element and define two CSS themes using custom properties.
All tabs inherit from the root — define the full token set once.

Target Chrome DevTools condensed aesthetics:

- System font stack, 11–12px UI font size.
- 20–24px row heights.
- Muted borders, minimal padding.
- No component library — a small shared CSS file is sufficient.

---

## 14.4 List Behaviour

All lists and log views across every tab share the same baseline behaviour:

**Sort order:** Newest first, fixed. Not user-configurable.

**Filtering:** Each list is filterable, with filters appropriate to its content. The exact filter set per tab will be refined once a working prototype exists — the specifics below are indicative, not final. The architecture must support adding and changing filter controls without structural rework: filters are predicates applied to the in-memory signal array, not baked into how data is loaded or stored.

Indicative filters per tab:

- **Commands** — command type, status
- **Events** — event type, stream ID, persistence category
- **Cache** — collection, eviction policy, frozen state
- **Read Models** — collection, has local changes
- **Sync** — collection, event category (gap, refetch, sync lifecycle)
- **Storage Explorer** — per-column text search

All filter state is local to the panel session — not persisted across DevTools open/close.

---

## 14.5 Panel Tabs

### 14.5.1 Commands Tab

**Data sources:**

- Initial snapshot: `commandQueue.listCommands()`
- Live updates: `command:enqueued`, `command:status-changed`, `command:completed`, `command:failed` events
- Debug detail: `debug:command-sent`, `debug:command-response` events (correlated via `correlationId`)

**UI:**

- Table: commandId (truncated), service, type, status (color badge), attempts, created, updated
- Status filter chips: pending, blocked, sending, succeeded, failed, cancelled
- Click row → detail panel: full payload, server response, error, dependency chain
- Action buttons: retry (failed), cancel (pending/blocked)
- Dependency visualization: if a command has `dependsOn`/`blockedBy`, show a mini DAG

**Retention:**

- Holds all commands for the current session (cleared on auth change).
- Clear button to manually reset.

### 14.5.2 Events Tab

**Data sources:**

- Live stream: `debug:ws-event-received`, `debug:ws-event-processed` events
- Gap tracking: `debug:gap-detected`, `debug:gap-repair-started`, `debug:gap-repair-completed`

**UI:**

- Streaming log view (newest at bottom, auto-scroll with pause-on-scroll-up)
- Columns: timestamp, event type, stream ID, revision, persistence (badge), processed (checkmark)
- Persistence filter: Permanent / Stateful / Anticipated
- Type filter: text input with autocomplete from seen types
- Stream filter: dropdown of seen stream IDs
- Expand row → full event data JSON + processor results (what read models were updated)
- Gap indicators: red banner inline when gap detected, green when repaired
- Session reset divider inserted on auth change

**Retention:**

- Holds all events for the current session (cleared on auth change). Virtual scrolling renders the tail without a DOM cap.
- Export button (JSON).

### 14.5.3 Cache Tab

**Data sources:**

- Initial snapshot: `storage.getAllCacheKeys()` (via debug RPC in worker mode)
- Live updates: `cache:evicted`, `cache:session-reset`, `cache:too-many-windows` events
- Key metadata: `debug:cache-key-acquired` events build the UUID → collection+params reverse map

**UI:**

- Table: key (truncated), collection, params (from reverse map, or "unknown" if not seen), holds, frozen, policy, TTL remaining, last accessed
- Sort by: holds (desc), TTL remaining (asc), last accessed (desc)
- Capacity bar: current count / maxCacheKeys
- Frozen indicator: snowflake icon
- Click row → detail: full key, all params, hold breakdown by window, associated read model count
- Actions: evict, freeze/unfreeze

### 14.5.4 Read Models Tab

**Data sources:**

- On-demand query: `storage.getReadModelsByCollection(collection)` (via debug RPC)
- Live updates: `readmodel:updated` events trigger re-fetch of changed IDs

**UI:**

- Left sidebar: collection list with entity counts
- Main area: entity table for selected collection
- Columns: id (truncated), has local changes (indicator), cache key, updated at
- Click row → two-pane view:
  - Left: `server_data` (JSON tree)
  - Right: `effective_data` (JSON tree)
  - Fields that differ are highlighted
- Filter: has local changes only, search by ID

> **Scope note:** Phase 5 ships two JSON trees with field-level highlights. Inline unified diff can be added later. Do not let diff renderer complexity block the tab shipping — use an existing library (`jsondiffpatch` or equivalent) or defer inline diffing entirely.

### 14.5.5 Sync Tab

**Data sources:**

- `syncManager.getAllStatus()` for collection sync state
- `connectivity:changed` events
- `sync:started`, `sync:completed`, `sync:failed`, `sync:seed-completed` events
- `debug:gap-detected`, `debug:gap-repair-*`, `debug:refetch-*` events

**UI:**

- Connection status banner: online/offline, WebSocket connected/disconnected
- Collection table: name, seeded (checkmark), syncing (spinner), last position, error
- Activity log: chronological list of sync events, gap repairs, refetches
- Force sync button per collection
- Session reset divider inserted on auth change

### 14.5.6 Storage Explorer Tab

**Data sources:**

- Direct storage queries via debug RPC methods
- `debug.getStorageStats()` for overview

**UI:**

- Table selector tabs: session, cache_keys, commands, cached_events, read_models
- Sortable/filterable data grid for selected table
- Row count per table in the tab label
- Click row → full record JSON
- Refresh button (manual, not live — this is for ad-hoc inspection)

---

## 14.6 Testing

### 14.6.1 Strategy

The `chrome.devtools.*` APIs are only available when the panel is running inside a real DevTools context, which cannot be opened programmatically. Testing is therefore split across three layers that together cover the meaningful surface area without requiring a live DevTools session.

**Layer 1 — Relay integration (Playwright + extension):**
Tests that load the built extension into a real Chromium instance via `--load-extension` and verify the full data path: `createCqrsClient` with `debug: true` → hook → content script → background service worker → panel. These confirm that events arrive correctly at the panel boundary, session resets fire on auth change, and the activation guard produces zero traffic when the panel is inactive. These tests run against the live demo app processes.

**Layer 2 — Panel UI (Playwright, no extension):**
The panel is a SolidJS app with a clean internal message interface boundary — it receives events through a defined contract, not directly from `chrome.runtime`. Tests load `panel.html` directly in a browser page, inject mock events through that interface, and assert rendering: correct rows appear, filters hide/show rows, session dividers insert at the right position, the standby banner appears when role is `standby`. No extension loading required.

**Layer 3 — Unit (Vitest):**
The background buffer logic (append, clear on auth change, windowed slice), filter predicates, and any pure utility functions. Fast, no browser.

### 14.6.2 Package Location

Extension tests live in `demos/todo-demo` alongside the existing Playwright suite, in a separate config file:

```
demos/todo-demo/
├── playwright.config.ts               # existing — app e2e tests
├── playwright.extension.config.ts     # new — extension tests
└── tests/
    ├── app/                           # existing
    └── extension/
        ├── relay.spec.ts              # Layer 1: full relay integration
        ├── panel-commands.spec.ts     # Layer 2: Commands Tab UI
        ├── panel-events.spec.ts       # Layer 2: Events Tab UI
        └── ...
```

### 14.6.3 Playwright Extension Config

The extension config differs from the existing `playwright.config.ts` in three ways: it uses a persistent browser context with `--load-extension`, it requires headed mode (Chromium extensions do not load in headless), and it has a `globalSetup` that fails fast if `packages/devtools/dist/` does not exist.

```typescript
// demos/todo-demo/playwright.extension.config.ts
import { defineConfig } from '@playwright/test'
import path from 'path'

const distPath = path.resolve(__dirname, '../../packages/devtools/dist')

export default defineConfig({
  testDir: './tests/extension',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  globalSetup: './tests/extension/global-setup.ts', // asserts dist/ exists
  use: {
    headless: false,
    // persistent context and extension args set per-test via fixtures
    // (chromium.launchPersistentContext does not use use.browserName)
  },
  webServer: [
    {
      command: 'npm run server',
      port: 3001,
      reuseExistingServer: !process.env['CI'],
    },
    {
      command: 'npm run client',
      port: 5173,
      reuseExistingServer: !process.env['CI'],
    },
    {
      command: 'npm run client:peer',
      port: 5174,
      reuseExistingServer: !process.env['CI'],
    },
  ],
})
```

The `webServer` entries reuse the same three processes as the existing config — server, client, and peer client. Because `playwright.extension.config.ts` lives in the same package as `playwright.config.ts`, the commands resolve identically with no path gymnastics.

**Running from the workspace root:**
`npm run` scripts in a workspace package cannot be invoked directly from the root without a shim. The cleanest approach is a root-level script that delegates via `--workspace`:

```json
// root package.json
"test:extension": "npm run test:extension --workspace=demos/todo-demo"
```

```json
// demos/todo-demo/package.json
"test": "playwright test",
"test:extension": "playwright test --config playwright.extension.config.ts"
```

### 14.6.4 Extension Test Fixture

Relay tests need a persistent context with the extension loaded. A shared fixture handles setup and teardown:

```typescript
// tests/extension/fixtures.ts
import { test as base, chromium } from '@playwright/test'
import path from 'path'

const distPath = path.resolve(__dirname, '../../../packages/devtools/dist')

export const test = base.extend({
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [`--disable-extensions-except=${distPath}`, `--load-extension=${distPath}`],
    })
    await use(context)
    await context.close()
  },
  page: async ({ context }, use) => {
    const page = await context.newPage()
    await use(page)
  },
})

export { expect } from '@playwright/test'
```

### 14.6.5 Global Setup

```typescript
// tests/extension/global-setup.ts
import fs from 'fs'
import path from 'path'

export default function globalSetup() {
  const distPath = path.resolve(__dirname, '../../../packages/devtools/dist')
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Extension dist not found at ${distPath}.\n` +
        `Run 'npm run build --workspace=packages/devtools' before running extension tests.`,
    )
  }
}
```

### 14.6.6 CI

Extension tests run as a separate CI job from the app e2e suite:

- Requires a display server (Xvfb) — headed mode on Linux.
- Depends on `packages/devtools` build completing first.
- Does not block app test results if the extension job fails.

---

## 14.7 Build Sequence

### 14.7.1 Phase 1: Library Prep

1. Gate debug behavior on `resolvedConfig.debug`.
2. Emit `debug:cache-key-acquired` from `CacheManager.acquire()`.
3. Emit `debug:ws-event-received` and `debug:ws-event-processed` from SyncManager/EventProcessorRunner.
4. Emit `debug:gap-*` events from SyncManager gap repair flow.
5. Emit `debug:command-sent` and `debug:command-response` from CommandQueue/command response handler (include `correlationId` on both).
6. Emit `debug:refetch-*` from SyncManager refetch flow.
7. Register `debug.*` RPC methods in worker entry points (behind debug flag).
8. Define `CqrsDebugAPI` interface (including `role: 'leader' | 'standby'`) and register on `window.__CQRS_TOOLKIT_DEVTOOLS__` when debug + hook present.

### 14.7.2 Phase 2: Extension Scaffold

1. Create `packages/devtools` workspace package (`"private": true`).
2. Manifest V3 setup, devtools page, panel HTML, package README with build and load-unpacked instructions.
3. Hook injection (`hook.ts`) + content script bridge. Hook compiled as standalone IIFE.
4. Message relay (page ↔ content script ↔ panel).
5. Connection lifecycle: detect client, activate/deactivate subscriptions.
6. Background service worker event buffer. Session boundary triggered by auth change events forwarded through the relay — on auth change, buffer clears and a divider message is sent to the panel. Page navigations do not clear the buffer.
7. Basic panel shell with tab navigation — SolidJS, condensed DevTools styling, light/dark theme tokens.
8. Vite multi-entry build config (hook as IIFE, content-script as IIFE, background, panel as ESM).
9. Standby tab banner wired up.

### 14.7.3 Phase 3: Commands Tab

- Most self-contained — `listCommands()` + command events give everything needed.
- Good first tab to validate the full data flow from client → hook → panel.
- Imports `CommandRecord` type directly from `@cqrs-toolkit/client`.

### 14.7.3 Phase 4: Test Setup

Add the extension test suite to `demos/todo-demo` before building further tabs, so subsequent phases can be validated incrementally rather than tested all at once at the end.

1. Add `playwright.extension.config.ts` to `demos/todo-demo` (see §14.6.3).
2. Add `test:extension` script to `demos/todo-demo/package.json` and a delegating script to root `package.json`.
3. Add `tests/extension/global-setup.ts` — fails fast if `packages/devtools/dist/` is absent.
4. Add `tests/extension/fixtures.ts` — persistent context fixture with extension loaded.
5. Write Layer 1 relay tests covering: client registers → events arrive at panel boundary, auth change clears buffer and emits divider, activation guard produces no traffic when inactive.
6. Write Layer 2 panel UI tests for the Commands Tab against `panel.html` directly.
7. Confirm CI can run headed Chromium (Xvfb if Linux); wire extension job as separate from app e2e job.

### 14.7.4 Phase 5: Events Tab

- Needs `debug:ws-event-*` events from Phase 1.
- High debugging value — this is where sync issues become visible.
- Establish the virtual-scrolling list component pattern here; reuse across all subsequent log views.
- Add Layer 2 panel tests for Events Tab.

### 14.7.5 Phase 6: Cache + Read Models + Sync Tabs

- These share the same infrastructure built in Phases 2–5.
- Cache tab needs the reverse key map from `debug:cache-key-acquired`.
- Read models tab: two JSON trees with field-level highlight diff; do not block on a full inline diff renderer — use `jsondiffpatch` or equivalent, or defer inline diffing.
- Sync tab is mostly an activity log from existing events.
- Add Layer 2 panel tests per tab.

### 14.7.6 Phase 7: Storage Explorer

- Most generic, lowest priority.
- Useful as a fallback when the structured tabs don't show what you need.
- Add Layer 2 panel tests.
