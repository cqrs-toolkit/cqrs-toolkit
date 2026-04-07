/**
 * Preload script helper for the Electron CQRS bridge.
 *
 * Two-phase port delivery:
 * 1. Preload receives the MessagePort from the main process and holds it.
 * 2. Renderer signals readiness via contextBridge callback.
 * 3. Preload transfers the port into the renderer via window.postMessage.
 *
 * This avoids the race where did-finish-load fires before the renderer's
 * async module has registered its message listener.
 *
 * @packageDocumentation
 */

import { contextBridge, ipcRenderer } from 'electron'
import { PORT_TRANSFER_CHANNEL } from './ipc.js'

/**
 * Initialize the preload bridge for CQRS port transfer.
 */
export function initElectronPreload(): void {
  let pendingPort: MessagePort | undefined
  let rendererReady = false

  function tryDeliver(): void {
    if (pendingPort && rendererReady) {
      window.postMessage(PORT_TRANSFER_CHANNEL, '*', [pendingPort])
      pendingPort = undefined
    }
  }

  // Hold the port when the main process sends it
  ipcRenderer.on(PORT_TRANSFER_CHANNEL, (event) => {
    const port = event.ports[0]
    if (port) {
      pendingPort = port
      tryDeliver()
    }
  })

  // Renderer calls this when its listener is registered
  contextBridge.exposeInMainWorld('__cqrs_toolkit_ready__', () => {
    rendererReady = true
    tryDeliver()
  })
}
