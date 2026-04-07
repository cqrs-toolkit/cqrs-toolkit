import { createElectronClient } from '@cqrs-toolkit/client-electron'
import { CqrsProvider } from '@cqrs-toolkit/client-solid'
import {
  CommandsPage,
  DashboardPage,
  NotesPage,
  TodosPage,
} from '@cqrs-toolkit/hypermedia-base/pages'
import { logProvider } from '@meticoeus/ddd-es'
import { Route, Router } from '@solidjs/router'
import pino from 'pino'
import { render } from 'solid-js/web'
import App from './App.js'
import './app.css'

// API calls from the renderer go through app://server/* which the main process
// proxies to the real server. The path is forwarded as-is, so
// app://server/api/auth/session → http://localhost:3002/api/auth/session.
// The utility process (worker) talks to the server directly at http://localhost:3002.
const SERVER_ORIGIN = 'app://server'

logProvider.setLogger(pino({ level: 'debug', browser: { asObject: false } }))

const client = await createElectronClient({ debug: true })

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root element')

render(
  () => (
    <CqrsProvider client={client}>
      <Router root={App}>
        <Route path="/" component={DashboardPage} />
        <Route path="/todos" component={TodosPage} />
        <Route path="/notes" component={NotesPage} />
        <Route path="/commands" component={CommandsPage} />
      </Router>
    </CqrsProvider>
  ),
  root,
)

// Authenticate and start sync AFTER UI is mounted and subscribed.
const session = await fetchSession()
await client.syncManager.setAuthenticated({ userId: session.userId })

// ── Helpers ──

function isSessionResponse(
  data: unknown,
): data is { authenticated: true; user: { sub: string }; expiresAtMs: number } {
  if (typeof data !== 'object' || data === null) return false
  const obj = data as Record<string, unknown>
  if (obj['authenticated'] !== true) return false
  if (typeof obj['user'] !== 'object' || obj['user'] === null) return false
  const user = obj['user'] as Record<string, unknown>
  return typeof user['sub'] === 'string' && typeof obj['expiresAtMs'] === 'number'
}

async function fetchSession(): Promise<{ userId: string }> {
  const res = await fetch(`${SERVER_ORIGIN}/api/auth/session`)
  if (!res.ok) throw new Error(`Session fetch failed: ${res.status}`)
  const data: unknown = await res.json()
  if (!isSessionResponse(data)) throw new Error('Invalid session response')
  return { userId: data.user.sub }
}
