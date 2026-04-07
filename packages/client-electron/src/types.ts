/**
 * Shared types for the Electron adapter package.
 *
 * Minimal interfaces for Electron APIs so the package does not require
 * a direct import of the `electron` module at the type level.
 */

/**
 * Minimal interface for Electron's MessagePortMain.
 * Used by the utility process to communicate with the renderer.
 */
export interface ElectronMessagePort {
  postMessage(message: unknown): void
  on(event: 'message', handler: (event: { data: unknown }) => void): void
  off(event: 'message', handler: (event: { data: unknown }) => void): void
  start(): void
}

/**
 * Init message sent from the main process to the utility process.
 * Carries the storage paths resolved by the bridge.
 */
export interface InitMessage {
  type: '@cqrs-toolkit/init'
  dbPath: string
  filesPath: string
}
