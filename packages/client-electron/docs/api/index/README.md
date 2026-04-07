[**@cqrs-toolkit/client-electron**](../README.md)

---

[@cqrs-toolkit/client-electron](../modules.md) / index

# index

@cqrs-toolkit/client-electron

Electron adapter for offline-first CQRS/event-sourcing client.
Uses better-sqlite3 in a utility process with the same proxy-based
interface as the browser worker modes.

Entry points:

- `.` — Renderer: `createElectronClient`, `ElectronAdapter`
- `./main` — Main process: `createElectronBridge`
- `./worker` — Utility process: `startElectronWorker`
- `./preload` — Preload script: `initElectronPreload`

## Classes

- [ElectronAdapter](classes/ElectronAdapter.md)

## Interfaces

- [CreateElectronClientConfig](interfaces/CreateElectronClientConfig.md)
- [ElectronAdapterConfig](interfaces/ElectronAdapterConfig.md)
- [ElectronMessagePort](interfaces/ElectronMessagePort.md)

## Variables

- [PORT_TRANSFER_CHANNEL](variables/PORT_TRANSFER_CHANNEL.md)
- [PORT_TRANSFER_TIMEOUT](variables/PORT_TRANSFER_TIMEOUT.md)

## Functions

- [createElectronClient](functions/createElectronClient.md)
