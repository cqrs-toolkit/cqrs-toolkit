/**
 * Main process entry point for the Electron CQRS bridge.
 *
 * Handles utility process lifecycle, MessagePort creation, and port
 * transfer to both the utility process and renderer windows.
 *
 * @example
 * ```typescript
 * import { createElectronBridge } from '@cqrs-toolkit/client-electron/main'
 *
 * const bridge = createElectronBridge({ workerPath: './cqrs-worker.js' })
 * bridge.connectWindow(mainWindow)
 * ```
 *
 * @packageDocumentation
 */

import { app, MessageChannelMain, utilityProcess, type BrowserWindow } from 'electron'
import { join } from 'node:path'
import { PORT_TRANSFER_CHANNEL } from './ipc.js'
import type { InitMessage } from './types.js'

/** Default root directory name inside userData (mirrors OPFS convention). */
const DEFAULT_ROOT_DIR = 'cqrs-client'

/** Default database filename. */
const DEFAULT_DB_NAME = 'cqrs-client'

/**
 * Configuration for the Electron bridge.
 */
export interface ElectronBridgeConfig {
  /** Absolute path to the consumer's utility process worker script. */
  workerPath: string
  /** Override: absolute path to the SQLite database file. */
  dbPath?: string
  /** Override: absolute path to the directory for command file uploads. */
  filesPath?: string
}

/**
 * Bridge between the Electron main process, utility process, and renderer.
 *
 * Owns the utility process lifecycle and the MessagePort pair that
 * connects the renderer to the utility process.
 */
export class ElectronBridge {
  private readonly child: ReturnType<typeof utilityProcess.fork>
  private readonly rendererPort: Electron.MessagePortMain
  private closed = false

  constructor(config: ElectronBridgeConfig) {
    const userData = app.getPath('userData')
    const rootDir = join(userData, DEFAULT_ROOT_DIR)
    const dbPath = config.dbPath ?? join(rootDir, `${DEFAULT_DB_NAME}.db`)
    const filesPath = config.filesPath ?? rootDir

    // Fork the utility process
    this.child = utilityProcess.fork(config.workerPath)

    // Create a MessagePort pair
    const { port1, port2 } = new MessageChannelMain()

    // Send one port + storage paths to the utility process
    const initMessage: InitMessage = {
      type: '@cqrs-toolkit/init',
      dbPath,
      filesPath,
    }
    this.child.postMessage(initMessage, [port1])

    // Keep the other port for the renderer
    this.rendererPort = port2
  }

  /**
   * Transfer the renderer-side MessagePort to a BrowserWindow.
   *
   * Call this after the window's webContents are ready. The preload script
   * (via `initElectronPreload`) picks up the port on the other side.
   */
  connectWindow(win: BrowserWindow): void {
    win.webContents.postMessage(PORT_TRANSFER_CHANNEL, null, [this.rendererPort])
  }

  /**
   * Close the bridge and terminate the utility process.
   */
  close(): void {
    if (this.closed) return
    this.closed = true
    this.child.kill()
  }
}

/**
 * Create an Electron bridge that manages the utility process and port transfer.
 *
 * @param config - Bridge configuration
 * @returns An initialized bridge instance
 */
export function createElectronBridge(config: ElectronBridgeConfig): ElectronBridge {
  return new ElectronBridge(config)
}
