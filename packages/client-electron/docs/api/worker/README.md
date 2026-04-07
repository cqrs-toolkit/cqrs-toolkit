[**@cqrs-toolkit/client-electron**](../README.md)

---

[@cqrs-toolkit/client-electron](../modules.md) / worker

# worker

Utility process entry point for the Electron CQRS worker.

Builds the full CQRS component stack directly — no WorkerOrchestrator.
This bootstrap is Electron-specific: it uses BetterSqliteDb for storage,
FsCommandFileStore for file uploads, and NodeConnectivityManager for
network detection (no navigator.onLine in Node.js).

The consumer writes a small worker file:

```typescript
import { startElectronWorker } from '@cqrs-toolkit/client-electron/worker'
import { cqrsConfig } from './cqrs-config'
startElectronWorker(cqrsConfig)
```

## Functions

- [startElectronWorker](functions/startElectronWorker.md)
