import { logProvider } from '@meticoeus/ddd-es'
import { Route, Router } from '@solidjs/router'
import pino from 'pino'
import { render } from 'solid-js/web'
import App from './App'
import './app.css'
import { initializeClient } from './cqrs-client'
import { CqrsProvider } from './cqrs-context'
import CommandsPage from './pages/CommandsPage'
import DashboardPage from './pages/DashboardPage'
import NotesPage from './pages/NotesPage'
import TodosPage from './pages/TodosPage'

logProvider.setLogger(pino({ level: 'debug', browser: { asObject: false } }))

const client = await initializeClient()
await client.sessionManager.signalAuthenticated('demo-user')

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
