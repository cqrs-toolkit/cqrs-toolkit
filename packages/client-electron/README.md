# @cqrs-toolkit/client-electron

Electron adapter for `@cqrs-toolkit/client`.
Runs the full CQRS component stack in an Electron utility process using `better-sqlite3` for persistent storage.
The renderer gets the same proxy-based `CqrsClient` interface as the browser worker modes.

## Setup

Four entry points, one per Electron context:

```typescript
// main.ts — Electron main process
import { createElectronBridge } from '@cqrs-toolkit/client-electron/main'
const bridge = createElectronBridge({ workerPath: './cqrs-worker.js' })
bridge.connectWindow(mainWindow)

// preload.ts
import { initElectronPreload } from '@cqrs-toolkit/client-electron/preload'
initElectronPreload()

// cqrs-worker.ts — utility process
import { startElectronWorker } from '@cqrs-toolkit/client-electron/worker'
import { cqrsConfig } from './cqrs-config'
startElectronWorker(cqrsConfig)

// renderer
import { createElectronClient } from '@cqrs-toolkit/client-electron'
const client = await createElectronClient()
```

## Storage paths

By default, data is stored under `app.getPath('userData')/cqrs-client/`:

| Path                         | Purpose              |
| ---------------------------- | -------------------- |
| `cqrs-client/cqrs-client.db` | SQLite database      |
| `cqrs-client/uploads/`       | Command file uploads |

Override via `createElectronBridge({ dbPath, filesPath })`.

## IPC channels

The library uses the following IPC channel internally.
If your preload script whitelists IPC channels, add it to your allowlist.
Do not use this channel name in your own code.

| Channel                       | Direction       | Purpose                                                                  |
| ----------------------------- | --------------- | ------------------------------------------------------------------------ |
| `@cqrs-toolkit/port-transfer` | main → renderer | Transfers the MessagePort connecting the renderer to the utility process |
