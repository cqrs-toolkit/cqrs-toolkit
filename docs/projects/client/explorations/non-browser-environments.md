# Non-browser environments

## Context

The client library was originally specified against browser environments with OPFS for offline persistence (Modes A, B, C). The intent has since broadened: non-browser environments are open to future work, not inherently out of scope.

Surfaced from the previous open-ambiguities section, reframed.

## Existing precedent

**Electron** is supported through the `@cqrs-toolkit/client-electron` package, which provides:

- `BetterSqliteDb` as the `ISqliteDb` implementation (replacing browser-side `opfs-sahpool` SQLite via the `IStorage` abstraction).
- `FsCommandFileStore` as the `node:fs` file storage implementation (replacing OPFS).
- `ElectronAdapter` running the execution stack in a utility process, with renderer windows reaching it via IPC.

The Electron port was a deliberate forcing function: ensuring the library's API (the `IStorage` / `ICommandFileStore` / adapter abstractions) is flexible enough to host non-browser implementations. That work validated the abstractions; the abstractions are now in place.

## Open environments

Future ports under consideration but not yet decided:

- **Node.js** (server-side or CLI use) — would need a `Node.js`-targeted adapter; storage and file-store impls already partly exist (`BetterSqliteDb`, `FsCommandFileStore`).
- **React Native** — would need a `ReactNative`-targeted adapter; storage probably via SQLite-RN bindings, file store via React Native FS.
- **Other JS runtimes** (Bun, Deno) — generally feasible if the runtime exposes a usable SQLite + file API.

## Repo shape

Each non-browser port lands as its own package within this monorepo (mirroring `client-electron`'s structure). The client core stays runtime-neutral; ports adapt the runtime-specific concerns. Beyond keeping the API flexible enough to accommodate them, non-browser support is not directly a `client` package concern.

## Status

Open. No active driver. The API has demonstrated flexibility (Electron); subsequent ports will land when a real consumer use case forces the design.
