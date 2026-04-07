/**
 * Electron main process for the hypermedia demo.
 *
 * Registers a custom `app://` protocol with two virtual hosts:
 * - `app://client/*`  — serves the renderer bundle with SPA fallback + COOP/COEP
 * - `app://api/*`  — proxies to the CQRS server (same-origin from renderer's perspective)
 *
 * This gives the renderer a real origin with full web platform capabilities
 * and transparent API proxying (no CORS, cookies flow naturally).
 */

import { createElectronBridge } from '@cqrs-toolkit/client-electron/main'
import { app, BrowserWindow, globalShortcut, net, protocol } from 'electron'
import { existsSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RENDERER_DIR = join(__dirname, 'renderer')
const SERVER_URL = 'http://localhost:3002'

// Enable remote debugging so Chrome at chrome://inspect can connect
app.commandLine.appendSwitch('remote-debugging-port', '9222')

// ---------------------------------------------------------------------------
// 1. Register app:// as a privileged scheme (must happen before app.ready)
// ---------------------------------------------------------------------------

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
])

// ---------------------------------------------------------------------------
// 2. App lifecycle
// ---------------------------------------------------------------------------

let bridge: ReturnType<typeof createElectronBridge>

app.whenReady().then(async () => {
  // Route by hostname: app://client/* → static files, app://api/* → server proxy
  protocol.handle('app', async (request) => {
    const url = new URL(request.url)

    if (url.hostname === 'server') {
      // Proxy to the CQRS server — path forwarded as-is
      return net.fetch(`${SERVER_URL}${url.pathname}${url.search}`, {
        method: request.method,
        headers: request.headers,
        body: request.body,
      })
    }

    // app://client/* — serve renderer bundle
    const filePath = join(RENDERER_DIR, url.pathname)
    if (existsSync(filePath) && statSync(filePath).isFile()) {
      return net.fetch(pathToFileURL(filePath).toString())
    }

    // SPA fallback — serve index.html with COOP/COEP headers
    const indexPath = join(RENDERER_DIR, 'index.html')
    const response = await net.fetch(pathToFileURL(indexPath).toString())
    const headers = new Headers(response.headers)
    headers.set('Cross-Origin-Opener-Policy', 'same-origin')
    headers.set('Cross-Origin-Embedder-Policy', 'require-corp')
    return new Response(response.body, { headers })
  })

  bridge = createElectronBridge({
    workerPath: join(__dirname, 'worker.js'),
  })

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  win.loadURL('app://client/')
  win.webContents.on('did-finish-load', () => {
    bridge.connectWindow(win)
  })

  globalShortcut.register('F12', () => {
    win.webContents.toggleDevTools()
  })
})

app.on('window-all-closed', () => {
  bridge?.close()
  app.quit()
})
