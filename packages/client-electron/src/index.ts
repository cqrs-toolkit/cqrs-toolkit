/**
 * @cqrs-toolkit/client-electron
 *
 * Electron adapter for offline-first CQRS/event-sourcing client.
 * Uses better-sqlite3 in a utility process with the same proxy-based
 * interface as the browser worker modes.
 *
 * Entry points:
 * - `.`         — Renderer: `createElectronClient`, `ElectronAdapter`
 * - `./main`    — Main process: `createElectronBridge`
 * - `./worker`  — Utility process: `startElectronWorker`
 * - `./preload` — Preload script: `initElectronPreload`
 *
 * @packageDocumentation
 */

// Renderer exports
export { createElectronClient } from './createElectronClient.js'
export type { CreateElectronClientConfig } from './createElectronClient.js'
export { ElectronAdapter } from './ElectronAdapter.js'
export type { ElectronAdapterConfig } from './ElectronAdapter.js'

// IPC constants (useful for consumers who need to whitelist channels)
export { PORT_TRANSFER_CHANNEL, PORT_TRANSFER_TIMEOUT } from './ipc.js'

// Types
export type { ElectronMessagePort } from './types.js'
