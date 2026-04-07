[**@cqrs-toolkit/client-electron**](../README.md)

---

[@cqrs-toolkit/client-electron](../modules.md) / main

# main

Main process entry point for the Electron CQRS bridge.

Handles utility process lifecycle, MessagePort creation, and port
transfer to both the utility process and renderer windows.

## Example

```typescript
import { createElectronBridge } from '@cqrs-toolkit/client-electron/main'

const bridge = createElectronBridge({ workerPath: './cqrs-worker.js' })
bridge.connectWindow(mainWindow)
```

## Classes

- [ElectronBridge](classes/ElectronBridge.md)

## Interfaces

- [ElectronBridgeConfig](interfaces/ElectronBridgeConfig.md)

## Functions

- [createElectronBridge](functions/createElectronBridge.md)
