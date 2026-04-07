/**
 * Renderer-side factory for creating a CQRS client in Electron.
 *
 * Two paths for obtaining the MessagePort:
 * 1. Automatic: received via the preload bridge (`initElectronPreload`)
 * 2. Explicit: consumer passes `config.port` directly
 *
 * @packageDocumentation
 */

import type { EnqueueCommand } from '@cqrs-toolkit/client'
import { CqrsClient, StableRefQueryManager } from '@cqrs-toolkit/client'
import type { Link } from '@meticoeus/ddd-es'
import { ElectronAdapter } from './ElectronAdapter.js'
import { PORT_TRANSFER_CHANNEL, PORT_TRANSFER_TIMEOUT } from './ipc.js'

/**
 * Configuration for creating an Electron CQRS client.
 */
export interface CreateElectronClientConfig {
  /** Explicit MessagePort (bypasses the preload bridge). */
  port?: MessagePort
  /** Request timeout in milliseconds (default: 30000). */
  requestTimeout?: number
  /** Enable debug mode. */
  debug?: boolean
}

/**
 * Create a CQRS client for an Electron renderer process.
 *
 * If no `port` is provided, waits for the preload bridge to deliver one
 * via `window.postMessage`. Returns a fully initialized `CqrsClient`
 * using the same proxy-based interface as the browser worker modes.
 *
 * @param config - Client configuration (all fields optional)
 * @returns A fully initialized CQRS client
 */
export async function createElectronClient<TLink extends Link, TCommand extends EnqueueCommand>(
  config: CreateElectronClientConfig = {},
): Promise<CqrsClient<TLink, TCommand>> {
  const port = config.port ?? (await waitForPort())

  const adapter = new ElectronAdapter<TLink, TCommand>({
    port,
    requestTimeout: config.requestTimeout,
  })

  try {
    await adapter.initialize()
  } catch (error) {
    await adapter.close()
    throw error
  }

  const stableQueryManager = new StableRefQueryManager<TLink>(adapter.queryManager)

  if (config.debug) {
    await adapter.enableDebug()
  }

  const closeResources = async (): Promise<void> => {
    await stableQueryManager.destroy()
  }

  return new CqrsClient<TLink, TCommand>(
    adapter,
    adapter.cacheManager,
    adapter.commandQueue,
    stableQueryManager,
    adapter.syncManager,
    closeResources,
    'electron',
  )
}

declare global {
  interface Window {
    __cqrs_toolkit_ready__?: () => void
  }
}

/**
 * Wait for the MessagePort transferred from the preload script.
 *
 * The preload holds the port until the renderer signals readiness via
 * `window.__cqrs_toolkit_ready__()`. Then the preload transfers it via
 * `window.postMessage` with the port as a transferable. This avoids the
 * race where `did-finish-load` fires before async module code runs.
 */
function waitForPort(): Promise<MessagePort> {
  return new Promise<MessagePort>((resolve, reject) => {
    const timer = setTimeout(() => {
      window.removeEventListener('message', handler)
      reject(
        new Error(
          `[cqrs-toolkit] Port transfer timed out after ${PORT_TRANSFER_TIMEOUT}ms. ` +
            `If your preload script whitelists IPC channels, ensure '${PORT_TRANSFER_CHANNEL}' is allowed.`,
        ),
      )
    }, PORT_TRANSFER_TIMEOUT)

    function handler(event: MessageEvent): void {
      if (event.data !== PORT_TRANSFER_CHANNEL) return
      const port = event.ports[0]
      if (!port) return

      clearTimeout(timer)
      window.removeEventListener('message', handler)
      resolve(port)
    }

    // Listen first, then signal ready — guarantees the listener
    // is registered before the preload delivers the port.
    window.addEventListener('message', handler)

    if (typeof window.__cqrs_toolkit_ready__ === 'function') {
      window.__cqrs_toolkit_ready__()
    }
  })
}
