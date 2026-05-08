# ADR 0001 (client-electron) — Utility-process worker topology, native better-sqlite3, per-environment bootstrap

**Status:** Accepted 2026-04-06

## Context

`@cqrs-toolkit/client` was originally browser-only.
The CQRS components (`CommandQueue`, `CacheManager`, `SyncManager`, `EventCache`, `ReadModelStore`, etc.) speak through `IStorage`, which has a single SQLite-backed implementation (`SQLiteStorage`).
`SQLiteStorage` itself talks through `ISqliteDb` — an async storage-engine abstraction that is the single platform-variation point at the storage layer.
Pre-existing implementations: `LocalSqliteDb` wraps the WASM build (in-process browser), `RemoteSqliteDb` proxies via postMessage to a child worker (cross-thread browser).

The Electron path needs the same CQRS surface but with a native SQLite engine running outside the browser sandbox.
OPFS, Web Workers, and `navigator.locks` have no role in that topology.
Three browser-bound assumptions had to be unwound:

1. **`@sqlite.org/sqlite-wasm` import path** in `LocalSqliteDb` is browser-only.
2. **OPFS VFS probing** at startup (`probeOpfs()`, `VfsType` discriminant) is browser-only.
3. **Worker-mode topology** (Web Worker / SharedWorker, MessagePort, `navigator.locks` active-tab election) is browser-only.

A second pressure was the adapter system itself.
The pre-existing `IAdapter` discriminated union was specific to browser modes — `IOnlineOnlyAdapter` (`mode: 'online-only'`), `IWorkerAdapter` (`mode: 'shared-worker' | 'dedicated-worker'`).
Electron is single-mode and doesn't fit the browser's three-way split.
The split was the wrong abstraction for cross-environment work.

## Decision

### Adapter mode-system generalization

`IAdapter` is restructured from a browser-shape-specific three-way `mode` discriminant into a generic two-way `kind` discriminant:

- **`IWindowAdapter`** (`kind: 'window'`) — main-thread CQRS components.
  The adapter exposes raw `storage`, `eventBus`, and `sessionManager` for in-process wiring by `createCqrsClient`.
- **`IWorkerAdapter`** (`kind: 'worker'`) — CQRS components live in a background process.
  The adapter exposes proxy objects (`commandQueue`, `queryManager`, `cacheManager`, `syncManager`) that forward calls via the message protocol.

Browser's three execution modes are now internal flavors of these two:

- `online-only` is a `kind: 'window'` adapter.
- `dedicated-worker` and `shared-worker` are both `kind: 'worker'` adapters with web-flavored implementations.

Electron uses only the `kind: 'worker'` variant.
`ElectronAdapter` implements `IWorkerAdapter` directly; CQRS components run in the Electron utility process, and the renderer holds the same proxy objects (`CommandQueueProxy`, `QueryManagerProxy`, `CacheManagerProxy`, `SyncManagerProxy`) used by the browser worker modes.
The renderer's `CqrsClient` surface is identical across browser worker modes and Electron — a renderer that worked in dedicated-worker mode works in Electron with the same code.

### Storage engine: `ISqliteDb` is the toolkit's internal seam

`@cqrs-toolkit/client-electron` ships `BetterSqliteDb` — a `better-sqlite3`-backed `ISqliteDb` implementation that wraps the synchronous engine in async-shaped methods.
`better-sqlite3` was chosen over `node:sqlite` for maturity, prepared-statement performance, and ecosystem reach.

`ISqliteDb` is the toolkit's storage-engine abstraction.
Today the toolkit ships three implementations across packages:

- `LocalSqliteDb` (browser, in-process WASM).
- `RemoteSqliteDb` (browser, cross-thread RPC).
- `BetterSqliteDb` (Electron / Node, native).

The interface is intentionally narrow — an execution abstraction over a SQLite engine, fully async, suitable for any process / IPC topology that can carry SQL strings + bindings.
A future Tauri or custom-RPC consumer adds a new `ISqliteDb` implementation in a parallel adapter package alongside `client-electron`; nothing in `@cqrs-toolkit/client` needs to change.
The `ISqliteDb` interface is the seam for that work, not a consumer-injected variation point inside `client-electron`.

### No shared component-wiring constructor; per-environment bootstrap

Earlier work explored extracting the CQRS component graph (and its cross-wiring) into a shared, platform-agnostic constructor that both the browser worker path and the Electron utility-process path could call.
That direction was tried and abandoned: the configurability needed to bridge platform differences was bug-prone, hard to read, and offered minimal payoff over honest duplication.

Each environment writes its own bootstrap:

- `WorkerOrchestrator` — browser worker path (`@cqrs-toolkit/client`).
- `bootstrapWorker` (inside `worker.ts`) — Electron utility-process path (`@cqrs-toolkit/client-electron`).
- A future Tauri analog would write its own.

To make this practical, `@cqrs-toolkit/client` exposes an `@cqrs-toolkit/client/internals` subpath export.
This is the deliberate seam for sister-package bootstrappers: `AnticipatedEventHandler`, `WriteQueue`, `createDomainExecutor`, the `register*Methods` RPC registration helpers, and other internal classes are reachable from there.
The `/internals` path itself signals the contract — *internal, private API; subject to change; do not depend on it from public consumer code*.
End consumers use the package's main entry point and never see these classes; bootstrap-writing sister packages use `/internals` and accept the maintenance coupling.

A change to the component graph (new component, new wiring) has to be made in every bootstrap.
The duplication is judged the correct cost; future changes pay it.

### Renderer / main / utility process entry points

`@cqrs-toolkit/client-electron` ships three entry points, one per Electron process:

- **Renderer** — `createElectronClient` (default export).
  Accepts `{ port?, requestTimeout?, debug? }`.
  Receives a `MessagePort` (via the preload bridge or explicitly), constructs `ElectronAdapter`, returns a fully-initialized `CqrsClient`.
- **Main process** — `createElectronBridge` (`./main` subpath).
  Accepts `ElectronBridgeConfig: { workerPath, dbPath?, filesPath? }`.
  Forks the utility process with the consumer-supplied worker script, creates the `MessagePort` pair, transfers one port and the resolved `dbPath` / `filesPath` to the utility process via an `InitMessage`, holds the other port for transfer to the renderer.
  Owns the utility-process lifecycle.
- **Utility process** — `startElectronWorker(config)` (`./worker` subpath).
  The consumer's worker script imports this and passes the shared `CqrsConfig`.
  On receiving the init message, `bootstrapWorker` constructs `new BetterSqliteDb(init.dbPath)`, builds the full CQRS stack inline (using `@cqrs-toolkit/client/internals`), and registers the RPC handlers against the transferred `MessagePort`.

### Storage path configuration

The consumer overrides `dbPath` (and `filesPath`) via `ElectronBridgeConfig` passed to `createElectronBridge` in the main process; the library constructs `BetterSqliteDb` internally from the resolved path inside the utility process.
Defaults are `app.getPath('userData')` + the toolkit's default DB name (and the same root for files).

The consumer does **not** construct `BetterSqliteDb` and does not hand an `ISqliteDb` instance to anything.
That topology never made sense in Electron — `BetterSqliteDb` opens an exclusive native handle, and only the utility process has the right execution context to do so.
The bridge is the configuration surface; the worker is the construction site.

### Scope expanded beyond the original SQLite-only memo

The shipping change covered Electron concerns the original 2026-03-08 memo did not anticipate:

- File-upload command file store — `FsCommandFileStore` in the utility process; `ElectronCommandFileStore` on the renderer side proxying through IPC.
  Storage path is `ElectronBridgeConfig.filesPath`.
- Node-side connectivity detection — `NodeConnectivityManager`.
  There is no `navigator.onLine` in the utility process.
- Hypermedia demo restructured into composable layers so it can run inside Electron alongside the existing browser modes.

These are extensions of the same decision — provide a complete native-platform alternative to the browser-worker topology — not separate decisions.

## Consequences

**Easier:**

- A non-Electron native consumer (Tauri, custom RPC) adds a new `ISqliteDb` implementation in a parallel adapter package and writes its own bootstrap.
  The `/internals` surface is the same one `client-electron` uses.
- Each environment's bootstrap is read-once-and-understood.
  No shared configuration matrix to thread platform-specific details through.
- `ISqliteDb` stays a stable, narrow contract usable across processes (better-sqlite3 in Node, RPC to Rust in Tauri, WASM in browser).
- The generalized `kind: 'window' | 'worker'` discriminant is honest about what the adapter does (where do components live?) rather than enumerating every browser-shape mode the toolkit might want to support.
- The renderer's `CqrsClient` interface is identical across browser worker modes and Electron, so consumer code that targeted the worker proxy path needs no change to run in Electron.

**Harder:**

- `BetterSqliteDb` wraps a synchronous engine in async signatures.
  Callers' awaits resolve essentially synchronously, which is fine functionally but can mask scheduling assumptions in tests that run against the Electron path versus the WASM path.
  Consumers writing tests against `ISqliteDb` should not depend on micro-task interleaving timing.
- Each environment's bootstrap is its own duplication.
  A change to the component graph (new component, new wiring) has to be made in every bootstrap (`WorkerOrchestrator`, `bootstrapWorker`, future Tauri equivalent).
  The duplication was judged the correct cost; future changes pay it.
- The `/internals` subpath couples sister packages to the toolkit's internal class shapes.
  Internal-API changes propagate as compile errors in `client-electron` (and any future sibling); consumers of the public surface remain unaffected.
- Electron-specific concerns (file store, connectivity, IPC) live in `@cqrs-toolkit/client-electron` and have their own evolution.
  A Tauri analog will need parallel implementations of those pieces.
  This is the cost of platform-specific surface beyond storage.
- Multi-window Electron apps coordinate at the application layer (one renderer is the canonical writer, others read), not inside this adapter.
  The adapter assumes single-writer; multi-window coordination is out of scope for this decision and would be a separate concern revisited if the topology changes.

## Notes

The "no schema-side branching" stance from the toolkit's storage philosophy applies equally on Electron.
`BetterSqliteDb` runs whatever SQL strings the library generates plus whatever DDL the consumer registered as collection migrations.
There is no Node-specific schema branch — the SQL the WASM path runs is the same SQL the Node path runs, modulo SQLite version differences.
The supported SQLite version is whatever ships with each engine; both are recent enough that the toolkit's surface (autoincrement, JSON1 functions, double-quoted identifiers) works identically.
